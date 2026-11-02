#!/usr/bin/env node
/**
 * export-glb.mjs
 * ==============
 * Builds the monument in Node (same module the viewer uses) and writes a
 * self-contained binary glTF — geometry + the photograph-derived textures
 * embedded — to public/models/ruwanwelisaya.glb.
 *
 *     node tools/export-glb.mjs
 *
 * three's bundled GLTFExporter needs a DOM (canvas/FileReader) for image
 * textures, so this script ships a tiny purpose-built GLB writer instead:
 * positions / normals / UVs / indices + PBR materials + JPEG/PNG images.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildMonument, createMaterials, MATERIAL_TEXTURE, TEXTURE_FILES } from '../src/monument.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEX_DIR = path.join(ROOT, 'public', 'textures');
const OUT_DIR = path.join(ROOT, 'public', 'models');
const OUT_FILE = path.join(OUT_DIR, 'ruwanwelisaya.glb');

// ---------------------------------------------------------------------------
// gather meshes
// ---------------------------------------------------------------------------

const mats = createMaterials({});
const root = buildMonument(mats, { trees: true });
root.updateMatrixWorld(true);

/** @type {{material: THREE.Material, geometories: {geometry, matrix}[]}[]} */
const byMaterial = new Map();
const meshes = [];

root.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  meshes.push(o);
});

console.log(`meshes: ${meshes.length}`);

// material -> texture key
const materialOrder = [];
for (const [, mat] of Object.entries(mats)) materialOrder.push(mat);
const matIndex = new Map(materialOrder.map((m, i) => [m, i]));

// any ad-hoc materials (trees) get appended
for (const o of meshes) {
  if (!matIndex.has(o.material)) {
    matIndex.set(o.material, materialOrder.length);
    materialOrder.push(o.material);
  }
}

// ---------------------------------------------------------------------------
// binary buffer builder
// ---------------------------------------------------------------------------

class BufferBuilder {
  constructor() {
    this.chunks = [];
    this.byteLength = 0;
  }
  add(buffer, align = 4) {
    const pad = (align - (this.byteLength % align)) % align;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.byteLength += pad;
    }
    const offset = this.byteLength;
    this.chunks.push(buffer);
    this.byteLength += buffer.length;
    return offset;
  }
  finish() {
    const pad = (4 - (this.byteLength % 4)) % 4;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.byteLength += pad;
    }
    return Buffer.concat(this.chunks, this.byteLength);
  }
}

const bin = new BufferBuilder();
const accessors = [];
const bufferViews = [];
const gltfMeshes = [];
const nodes = [];

function addBufferView(buffer, target) {
  const offset = bin.add(buffer);
  bufferViews.push({
    buffer: 0,
    byteOffset: offset,
    byteLength: buffer.length,
    ...(target ? { target } : {}),
  });
  return bufferViews.length - 1;
}

function addAccessor(array, type, componentType, extra = {}) {
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const view = addBufferView(buffer, 34962); // ARRAY_BUFFER
  accessors.push({ bufferView: view, componentType, count: array.length / (type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1), type, ...extra });
  return accessors.length - 1;
}

// ---------------------------------------------------------------------------
// per-material geometry merging
// ---------------------------------------------------------------------------

const geometryByMaterial = new Map(); // materialIndex -> {pos:[], nrm:[], uv:[], idx:[], offset}

function bucketFor(mi) {
  if (!geometryByMaterial.has(mi)) {
    geometryByMaterial.set(mi, { pos: [], nrm: [], uv: [], idx: [], count: 0 });
  }
  return geometryByMaterial.get(mi);
}

const v = new THREE.Vector3();
const nm = new THREE.Matrix3();

for (const o of meshes) {
  const mi = matIndex.get(o.material);
  const b = bucketFor(mi);
  const geo = o.geometry;
  if (!geo.attributes.position) continue;

  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const index = geo.index;

  const m = o.matrixWorld;
  nm.getNormalMatrix(m);

  const base = b.count;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    b.pos.push(v.x, v.y, v.z);
    if (nrm) {
      v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      b.nrm.push(v.x, v.y, v.z);
    } else {
      b.nrm.push(0, 1, 0);
    }
    if (uv) b.uv.push(uv.getX(i), uv.getY(i));
    else b.uv.push(0, 0);
  }
  if (index) {
    for (let i = 0; i < index.count; i++) b.idx.push(base + index.getX(i));
  } else {
    for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }
  b.count += pos.count;
}

// ---------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------

const images = [];
const textures = [];
const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
const imageIndexByKey = new Map();

function ensureTexture(key) {
  if (!key) return null;
  if (imageIndexByKey.has(key)) return imageIndexByKey.get(key);
  const rel = TEXTURE_FILES[key];
  if (!rel) return null;
  const file = path.join(ROOT, 'public', rel);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing texture ${rel}`);
    return null;
  }
  const bytes = fs.readFileSync(file);
  const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const view = addBufferView(bytes, undefined);
  images.push({ bufferView: view, mimeType: mime });
  textures.push({ sampler: 0, source: images.length - 1 });
  const idx = textures.length - 1;
  imageIndexByKey.set(key, idx);
  return idx;
}

// ---------------------------------------------------------------------------
// glTF materials
// ---------------------------------------------------------------------------

const gltfMaterials = materialOrder.map((mat) => {
  const texKey = mat.userData?.textureKey ?? null;
  const texIdx = ensureTexture(texKey);
  const pbr = {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: mat.metalness ?? 0,
    roughnessFactor: mat.roughness ?? 1,
  };
  if (texIdx !== null) pbr.baseColorTexture = { index: texIdx };
  if (mat.color && !texIdx) {
    pbr.baseColorFactor = [mat.color.r, mat.color.g, mat.color.b, 1];
  }
  const out = {
    name: mat.name || 'material',
    pbrMetallicRoughness: pbr,
    doubleSided: mat.side === THREE.DoubleSide,
  };
  if (mat.transparent && mat.alphaTest > 0) {
    out.alphaMode = 'MASK';
    out.alphaCutoff = mat.alphaTest;
  }
  return out;
});

// ---------------------------------------------------------------------------
// meshes / nodes
// ---------------------------------------------------------------------------

let vertexTotal = 0;
let triangleTotal = 0;

for (const [mi, b] of geometryByMaterial) {
  if (b.count === 0) continue;
  const posArr = new Float32Array(b.pos);
  const nrmArr = new Float32Array(b.nrm);
  const uvArr = new Float32Array(b.uv);
  const idxArr = new Uint32Array(b.idx);

  // bounds
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posArr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], posArr[i + k]);
      max[k] = Math.max(max[k], posArr[i + k]);
    }
  }

  const aPos = addAccessor(posArr, 'VEC3', 5126, { min, max });
  const aNrm = addAccessor(nrmArr, 'VEC3', 5126);
  const aUv = addAccessor(uvArr, 'VEC2', 5126);
  const idxView = addBufferView(Buffer.from(idxArr.buffer), 34963);
  const aIdx = accessors.length;
  accessors.push({ bufferView: idxView, componentType: 5125, count: idxArr.length, type: 'SCALAR' });

  vertexTotal += b.count;
  triangleTotal += idxArr.length / 3;

  gltfMeshes.push({
    name: materialOrder[mi]?.name || `part_${mi}`,
    primitives: [
      {
        attributes: { POSITION: aPos, NORMAL: aNrm, TEXCOORD_0: aUv },
        indices: aIdx,
        material: mi,
        mode: 4,
      },
    ],
  });
}

nodes.push({
  name: 'Ruwanwelisaya_Maha_Seya',
  mesh: 0,
  children: gltfMeshes.slice(1).map((_, i) => i + 1),
});

// the merged-mesh approach writes one mesh per material; hook them all onto a root node
gltfMeshes.forEach((m, i) => {
  nodes.push({ name: m.name, mesh: i });
});
nodes[0] = { name: 'Ruwanwelisaya_Maha_Seya', children: gltfMeshes.map((_, i) => i + 1) };

const binBuffer = bin.finish();

const gltf = {
  asset: {
    version: '2.0',
    generator: 'Ruwanwelisaya procedural reconstruction (Arena Agent)',
    copyright: 'Derived from a single photograph of the Ruwanwelisaya Maha Seya',
  },
  scene: 0,
  scenes: [{ name: 'Ruwanwelisaya', nodes: [0] }],
  nodes,
  meshes: gltfMeshes,
  materials: gltfMaterials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binBuffer.length }],
  ...(images.length ? { images, textures, samplers } : {}),
};

// ---------------------------------------------------------------------------
// GLB container
// ---------------------------------------------------------------------------

let json = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPad = (4 - (json.length % 4)) % 4;
if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);

const binPad = (4 - (binBuffer.length % 4)) % 4;
const binChunk = binPad ? Buffer.concat([binBuffer, Buffer.alloc(binPad)]) : binBuffer;

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + binChunk.length, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(json.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN'

fs.mkdirSync(OUT_DIR, { recursive: true });
const glb = Buffer.concat([header, jsonHeader, json, binHeader, binChunk]);
fs.writeFileSync(OUT_FILE, glb);

console.log(`\nwrote ${path.relative(ROOT, OUT_FILE)}`);
console.log(`  ${(glb.length / 1048576).toFixed(2)} MB`);
console.log(`  ${gltfMeshes.length} primitives / ${gltfMaterials.length} materials / ${textures.length} textures`);
console.log(`  ${vertexTotal.toLocaleString()} vertices / ${Math.round(triangleTotal).toLocaleString()} triangles`);

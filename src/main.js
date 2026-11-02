/**
 * main.js — the browser viewer.
 *
 * Loads the photograph-derived textures, builds the monument with
 * src/monument.js, and lets you orbit the sun across it.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import {
  buildMonument,
  createMaterials,
  TEXTURE_FILES,
  D,
} from './monument.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const overlayStatus = document.getElementById('overlayStatus');

/* ------------------------------------------------------------------------- */
/*  Renderer                                                                 */
/* ------------------------------------------------------------------------- */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x7ea6cd, 1);

/* ------------------------------------------------------------------------- */
/*  Scene, camera, controls                                                  */
/* ------------------------------------------------------------------------- */

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd3e3ef, 520, 1750);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, 4000);
camera.position.set(138, 56, 188);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 34, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 55;
controls.maxDistance = 780;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.32;
controls.zoomSpeed = 0.8;

/* ------------------------------------------------------------------------- */
/*  Lighting                                                                 */
/* ------------------------------------------------------------------------- */

const hemi = new THREE.HemisphereLight(0xbfd8f2, 0x8a7355, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3dd, 3.1);
sun.position.set(140, 190, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 900;
const S = 170;
sun.shadow.camera.left = -S;
sun.shadow.camera.right = S;
sun.shadow.camera.top = S;
sun.shadow.camera.bottom = -S;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.5;
scene.add(sun);

// a cool fill from the opposite side, as the sky bounce does in the photo
const fill = new THREE.DirectionalLight(0xa8c6ea, 0.5);
fill.position.set(-160, 90, -120);
scene.add(fill);

/* ------------------------------------------------------------------------- */
/*  Textures                                                                 */
/* ------------------------------------------------------------------------- */

function loadTextures(onProgress) {
  const keys = Object.keys(TEXTURE_FILES);
  const loader = new THREE.TextureLoader();
  const maps = {};
  let done = 0;

  return new Promise((resolve) => {
    keys.forEach((key) => {
      loader.load(
        TEXTURE_FILES[key],
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.colorSpace =
            key.includes('Bump') || key === 'elephantHeight' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          maps[key] = tex;
          done += 1;
          onProgress?.(done / keys.length);
          if (done === keys.length) resolve(maps);
        },
        undefined,
        () => {
          done += 1;
          if (done === keys.length) resolve(maps);
        }
      );
    });
  });
}

/* ------------------------------------------------------------------------- */
/*  Sky dome — painted from the photograph's own sky gradient                */
/* ------------------------------------------------------------------------- */

function buildSky() {
  const geo = new THREE.SphereGeometry(2600, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1f6fc4) },
      midColor: { value: new THREE.Color(0x7fb2e2) },
      bottomColor: { value: new THREE.Color(0xe6eef4) },
      offset: { value: 120.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform float offset;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        vec3 c = mix(bottomColor, midColor, smoothstep(-0.05, 0.32, h));
        c = mix(c, topColor, smoothstep(0.25, 0.95, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------------- */
/*  Build                                                                    */
/* ------------------------------------------------------------------------- */

let monument = null;
let materials = null;
let treesGroup = null;
let usingTextures = true;

const state = {
  turntable: true,
  wireframe: false,
};

async function init() {
  overlayStatus.textContent = 'sampling the photograph…';
  const maps = await loadTextures((p) => {
    overlayStatus.textContent = `sampling the photograph… ${Math.round(p * 100)}%`;
  });

  overlayStatus.textContent = 'raising the dome…';
  await new Promise((r) => setTimeout(r, 60));

  // PMREM environment, so the gilded finial has something to reflect
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.06).texture;
  scene.environmentIntensity = 0.42;
  room.dispose();
  pmrem.dispose();

  scene.add(buildSky());

  materials = createMaterials(maps);

  monument = buildMonument(materials, { trees: true });
  treesGroup = monument.getObjectByName('treeline');
  monument.traverse((o) => {
    if (o.isMesh) o.userData.photoMaterial = o.material;
  });
  scene.add(monument);

  // ---- stats -----------------------------------------------------------
  let tris = 0;
  monument.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  const stats = document.querySelector('#stats dl');
  if (stats) {
    stats.children[1].lastElementChild.textContent = `${D.finialTopY.toFixed(0)} m`;
    stats.children[3].lastElementChild.textContent = `${Math.round(tris / 1000)}k`;
  }
  const credit = document.querySelector('.credit');
  if (credit) credit.innerHTML = `Textures sampled from the uploaded photograph.<br />Model generated procedurally &mdash; ${Math.round(tris / 1000)}k triangles.`;

  overlayStatus.textContent = 'ready';
  setTimeout(() => overlay.classList.add('is-hidden'), 260);

  animate();
}

/* ------------------------------------------------------------------------- */
/*  Camera presets                                                           */
/* ------------------------------------------------------------------------- */

const VIEWS = {
  front: { pos: [0, 38, 245], target: [0, 40, 0] },
  'three-quarter': { pos: [138, 56, 188], target: [0, 34, 0] },
  aerial: { pos: [96, 152, 186], target: [0, 14, 0] },
  eye: { pos: [24, 7, 96], target: [0, 20, 0] },
  detail: { pos: [-62, 12, 96], target: [0, 10, 30] },
};

let camTween = null;

function goTo(name) {
  const v = VIEWS[name];
  if (!v) return;
  controls.autoRotate = false;
  document.querySelectorAll('.view').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
  camTween = {
    t: 0,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...v.pos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...v.target),
  };
  syncTurntableCheckbox();
}

function syncTurntableCheckbox() {
  const cb = document.getElementById('turntable');
  if (cb) cb.checked = controls.autoRotate;
}

/* ------------------------------------------------------------------------- */
/*  Sun position from a time-of-day slider                                   */
/* ------------------------------------------------------------------------- */

const SUN_STOPS = [
  { t: 0.0, el: 4, azimuth: 118, color: 0xffb26b, intensity: 1.5, exposure: 1.25, label: 'golden hour' },
  { t: 0.35, el: 22, azimuth: 100, color: 0xffd9a8, intensity: 2.4, exposure: 1.12, label: 'morning' },
  { t: 0.62, el: 46, azimuth: 62, color: 0xfff3dd, intensity: 3.1, exposure: 1.02, label: 'afternoon' },
  { t: 0.85, el: 68, azimuth: 20, color: 0xffffff, intensity: 3.4, exposure: 0.96, label: 'midday' },
  { t: 1.0, el: 30, azimuth: -42, color: 0xffe7c4, intensity: 2.6, exposure: 1.06, label: 'evening' },
];

function applySun(t) {
  let a = SUN_STOPS[0];
  let b = SUN_STOPS[SUN_STOPS.length - 1];
  for (let i = 0; i < SUN_STOPS.length - 1; i++) {
    if (t >= SUN_STOPS[i].t && t <= SUN_STOPS[i + 1].t) {
      a = SUN_STOPS[i];
      b = SUN_STOPS[i + 1];
      break;
    }
  }
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  const el = THREE.MathUtils.lerp(a.el, b.el, k) * (Math.PI / 180);
  const az = THREE.MathUtils.lerp(a.azimuth, b.azimuth, k) * (Math.PI / 180);
  const radius = 320;
  sun.position.set(
    Math.sin(az) * Math.cos(el) * radius,
    Math.sin(el) * radius,
    Math.cos(az) * Math.cos(el) * radius
  );
  sun.color.lerpColors(new THREE.Color(a.color), new THREE.Color(b.color), k);
  sun.intensity = THREE.MathUtils.lerp(a.intensity, b.intensity, k);
  hemi.intensity = THREE.MathUtils.lerp(0.55, 0.95, Math.min(1, el / 1.1));
  renderer.toneMappingExposure = THREE.MathUtils.lerp(a.exposure, b.exposure, k);
  const label = document.getElementById('sunLabel');
  if (label) label.textContent = k < 0.5 ? a.label : b.label;
}

/* ------------------------------------------------------------------------- */
/*  UI wiring                                                                */
/* ------------------------------------------------------------------------- */

document.querySelectorAll('.view').forEach((btn) => {
  btn.addEventListener('click', () => goTo(btn.dataset.view));
});

document.getElementById('turntable')?.addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
  state.turntable = e.target.checked;
  if (e.target.checked) document.querySelectorAll('.view').forEach((b) => b.classList.remove('is-active'));
});

document.getElementById('wireframe')?.addEventListener('change', (e) => {
  state.wireframe = e.target.checked;
  monument?.traverse((o) => {
    if (o.isMesh && o.material && 'wireframe' in o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        m.wireframe = state.wireframe;
      });
    }
  });
});

const clayByPhotoMaterial = new Map();
function clayFor(mat) {
  if (!mat) return null;
  if (!clayByPhotoMaterial.has(mat)) {
    const isGold = mat.name === 'gold';
    const isRed = mat.name === 'red';
    const clay = new THREE.MeshStandardMaterial({
      color: isGold ? 0xc9a227 : isRed ? 0xb03a34 : 0xdad5c9,
      roughness: isGold ? 0.3 : 0.88,
      metalness: isGold ? 0.85 : 0.0,
      side: mat.side,
      transparent: !!mat.transparent,
      alphaTest: mat.alphaTest || 0,
    });
    clayByPhotoMaterial.set(mat, clay);
  }
  return clayByPhotoMaterial.get(mat);
}

document.getElementById('textures')?.addEventListener('change', (e) => {
  usingTextures = e.target.checked;
  if (!monument) return;
  monument.traverse((o) => {
    if (!o.isMesh || !o.userData.photoMaterial) return;
    o.material = usingTextures ? o.userData.photoMaterial : clayFor(o.userData.photoMaterial);
  });
});

document.getElementById('trees')?.addEventListener('change', (e) => {
  if (treesGroup) treesGroup.visible = e.target.checked;
});

document.getElementById('sun')?.addEventListener('input', (e) => {
  applySun(Number(e.target.value) / 100);
});

document.getElementById('panelToggle')?.addEventListener('click', () => {
  document.getElementById('panel').classList.toggle('is-open');
});

// ---- exports -------------------------------------------------------------
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

document.getElementById('dlObj')?.addEventListener('click', () => {
  if (!monument) return;
  const obj = new OBJExporter().parse(monument);
  download(new Blob([obj], { type: 'text/plain' }), 'ruwanwelisaya.obj');
});

document.getElementById('dlStl')?.addEventListener('click', () => {
  if (!monument) return;
  const stl = new STLExporter().parse(monument, { binary: true });
  download(new Blob([stl], { type: 'model/stl' }), 'ruwanwelisaya.stl');
});

// ---- hide the hint once the user starts exploring ------------------------
const hint = document.querySelector('.hint');
// the turntable starts on the three-quarter view
renderer.domElement.addEventListener('pointerdown', () => {
  if (hint) hint.style.opacity = '0';
}, { once: true });

/* ------------------------------------------------------------------------- */
/*  Loop                                                                     */
/* ------------------------------------------------------------------------- */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt * 1.5);
    const e = 1 - Math.pow(1 - camTween.t, 3);
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
    if (camTween.t >= 1) camTween = null;
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------------- */

applySun(0.62);
init().catch((err) => {
  console.error(err);
  overlayStatus.textContent = 'could not build the model — see console';
});

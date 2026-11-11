/**
 * monument.js
 * ===========
 * Procedural, photograph-textured reconstruction of the Ruwanwelisaya Maha Seya
 * (Anuradhapura, Sri Lanka) — the "Great Stupa" built by King Dutugemunu.
 *
 * This module is pure geometry: no DOM, no WebGL. It is imported both by the
 * browser viewer (src/main.js) and by the Node GLB exporter
 * (tools/export-glb.mjs), so the exported model is exactly the monument you
 * orbit in the viewer.
 *
 * Proportions were measured off the uploaded photograph:
 *   • the whitewashed dome silhouette is a slightly pointed bubble
 *     (r = R·cos^0.9 a), springing from a masonry drum;
 *   • a red "kasaya" cloth band is slung just above the springing;
 *   • a ring of basalt elephant reliefs stands on the outer terrace wall;
 *   • a square harmika (deva-kuti) with fluted faces crowns the dome,
 *     carrying a ribbed conical spire and the gilded finial.
 *
 * Metric scale: real dome diameter ≈ 98 m.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------------- */
/*  Texture manifest — every map is cropped out of the uploaded photograph    */
/* ------------------------------------------------------------------------- */

export const TEXTURE_FILES = {
  dome: 'textures/dome_white.jpg',
  domeBump: 'textures/dome_white_bump.jpg',
  stone: 'textures/stone_weathered.jpg',
  stoneBump: 'textures/stone_weathered_bump.jpg',
  red: 'textures/red_band.jpg',
  fringe: 'textures/red_fringe.jpg',
  elephant: 'textures/elephant_relief.png',
  elephantHeight: 'textures/elephant_relief_height.jpg',
  sand: 'textures/sand_courtyard.jpg',
  sandBump: 'textures/sand_courtyard_bump.jpg',
  harmika: 'textures/harmika_face.jpg',
  harmikaBump: 'textures/harmika_face_bump.jpg',
  spire: 'textures/spire_ribbed.jpg',
  gold: 'textures/gold_finial.jpg',
  plaster: 'textures/plaster_white.jpg',
  plasterBump: 'textures/plaster_white_bump.jpg',
};

/* ------------------------------------------------------------------------- */
/*  Dimensions (metres)                                                      */
/* ------------------------------------------------------------------------- */

export const D = {
  // Scale: the dome silhouette in the photograph is a circle of radius 766 px;
  // taking the great stupa's dome radius as 42.6 m fixes 0.0556 m per pixel.
  // Heights that are local to one radius (apex above the springing, drum, band,
  // harmika, spire) are then read straight off the photograph; the overall
  // height is composed from them.
  //
  //   dome radius      766 px → 42.6 m   (85 m across)
  //   apex above spring 705 px → 39.2 m
  //   sphere centre   1486 px → 4 m BELOW the springing line
  //   tip above apex   551 px → 30.6 m
  //   harmika          370 px wide → 20.6 m square

  // ---- whitewashed dome --------------------------------------------------
  domeR: 42.6,
  get domeSphereR() {
    return 43.6;
  },
  get domeSphereCY() {
    return this.springY - 4.0;
  },
  get domeH() {
    return this.domeSphereR + this.domeSphereCY - this.springY;
  },
  springY: 8.4,
  get apexY() {
    return this.springY + this.domeH;
  },

  // red kasaya band, slung just above the springing line
  bandBottom: 0.1,
  bandTop: 2.35,

  // ---- weathered masonry drum the dome sits on ---------------------------
  drumTopR: 44.6,
  drumBaseR: 46.8,
  drumBaseY: 4.2,

  // ---- paved ambulatory terrace + outer elephant wall --------------------
  terraceY: 4.2,
  wallR: 57.4,
  wallTop: 4.2,
  elephantH: 2.95,
  elephantCount: 224,
  /** the photographed relief is 0.54 as wide as it is tall and fills its pitch */
  get elephantW() {
    return 0.96 * ((2 * Math.PI * this.wallR) / this.elephantCount);
  },

  // ---- harmika / deva-kuti ----------------------------------------------
  harmikaSide: 20.6,
  get harmikaPlinthY() {
    return this.apexY - 1.3;
  },
  get harmikaTopY() {
    return this.harmikaPlinthY + 7.2;
  },

  // ---- ribbed conical spire ---------------------------------------------
  get spireBaseY() {
    return this.harmikaTopY + 1.8;
  },
  get spireTopY() {
    return this.spireBaseY + 17.6;
  },
  spireBaseR: 5.5,
  spireTopR: 1.95,

  // ---- gilded finial -----------------------------------------------------
  get finialBaseY() {
    return this.spireTopY - 0.15;
  },
  get finialTopY() {
    return this.finialBaseY + 5.9;
  },

  courtsR: 1500,
};

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */

/** Bake a texture tiling into the UVs, so the WebGL view and the GLB export
 *  show exactly the same tiling. */
export function tileUV(geom, su = 1, sv = 1) {
  const uv = geom.attributes.uv;
  if (!uv) return geom;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geom;
}

/** Radius of the dome surface at height `y` — solved from the fitted sphere. */
export function domeRadiusAt(y) {
  const dy = y - D.domeSphereCY;
  const r2 = D.domeSphereR * D.domeSphereR - dy * dy;
  return Math.sqrt(Math.max(r2, 0));
}

function lathe(points, segments = 160) {
  return new THREE.LatheGeometry(points, segments);
}

function annulus(inner, outer, segments = 160) {
  const g = new THREE.RingGeometry(inner, outer, segments, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

function mesh(geom, mat, name) {
  const m = new THREE.Mesh(geom, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------------- */
/*  Materials                                                                */
/* ------------------------------------------------------------------------- */

/** Which photograph-derived map each material is driven by (used by exporter). */
export const MATERIAL_TEXTURE = {
  dome: 'dome',
  plaster: 'plaster',
  plasterWhite: 'plaster',
  stone: 'stone',
  red: 'red',
  fringe: 'fringe',
  sand: 'sand',
  elephant: 'elephant',
  harmika: 'harmika',
  spire: 'spire',
  gold: 'gold',
};

/**
 * @param {Record<string, THREE.Texture>} maps  loaded textures (may be empty)
 */
export function createMaterials(maps = {}) {
  const t = (k) => maps[k];
  const std = (opts) => new THREE.MeshStandardMaterial(opts);

  const mats = {
    dome: std({
      map: t('dome'),
      bumpMap: t('domeBump'),
      bumpScale: 0.25,
      roughness: 0.93,
      metalness: 0.0,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    plaster: std({
      map: t('plaster'),
      bumpMap: t('plasterBump'),
      bumpScale: 0.15,
      roughness: 0.95,
      metalness: 0.0,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    stone: std({
      map: t('stone'),
      bumpMap: t('stoneBump'),
      bumpScale: 0.45,
      roughness: 0.98,
      metalness: 0.0,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    red: std({
      map: t('red'),
      roughness: 0.82,
      metalness: 0.0,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    fringe: std({
      map: t('fringe'),
      roughness: 0.45,
      metalness: 0.55,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    sand: std({
      map: t('sand'),
      bumpMap: t('sandBump'),
      bumpScale: 0.2,
      roughness: 1.0,
      metalness: 0.0,
      color: 0xffffff,
    }),
    elephant: std({
      map: t('elephant'),
      bumpMap: t('elephantHeight'),
      bumpScale: 0.35,
      roughness: 0.74,
      metalness: 0.04,
      transparent: false,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      color: 0xffffff,
    }),
    harmika: std({
      map: t('harmika'),
      bumpMap: t('harmikaBump'),
      bumpScale: 0.3,
      roughness: 0.9,
      metalness: 0.0,
      color: 0xffffff,
    }),
    spire: std({
      map: t('spire'),
      bumpScale: 0,
      roughness: 0.86,
      metalness: 0.0,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    gold: std({
      map: t('gold'),
      roughness: 0.3,
      metalness: 0.78,
      color: 0xffffff,
    }),
    plasterWhite: std({
      map: t('plaster'),
      bumpMap: t('plasterBump'),
      bumpScale: 0.08,
      roughness: 0.94,
      metalness: 0.0,
      color: 0xfbfaf6,
      side: THREE.DoubleSide,
    }),
    grass: std({ color: 0x8d8b60, roughness: 1.0 }),
    stoneDark: std({ color: 0x7a6f60, roughness: 0.95 }),
    bronze: std({ color: 0x5f5240, roughness: 0.55, metalness: 0.6 }),
  };

  for (const [key, mat] of Object.entries(mats)) {
    mat.userData.textureKey = MATERIAL_TEXTURE[key] ?? null;
    mat.name = key;
  }
  return mats;
}

/* ------------------------------------------------------------------------- */
/*  Parts                                                                    */
/* ------------------------------------------------------------------------- */

/** Planar (XZ) UVs, so big ground surfaces tile without radial stretching. */
function planarUV(geom, metresPerTile, offset = 0) {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    // the offset decorrelates the two grids so their seams do not line up
    uv.setXY(i, pos.getX(i) / metresPerTile + offset, pos.getZ(i) / metresPerTile);
  }
  uv.needsUpdate = true;
  return geom;
}

function buildCourtyard(mats) {
  const g = new THREE.Group();
  g.name = 'courtyard';

  // the swept sand courtyard, inside the low white kerb
  const sand = new THREE.RingGeometry(0.4, 112, 200, 60);
  sand.rotateX(-Math.PI / 2);
  planarUV(sand, 26);
  const ground = new THREE.Mesh(sand, mats.sand);
  ground.receiveShadow = true;
  ground.name = 'sand_courtyard';
  g.add(ground);

  // the plain beyond, so the courtyard edge reads as a kerb and not a horizon
  const plain = new THREE.CircleGeometry(2400, 128);
  plain.rotateX(-Math.PI / 2);
  planarUV(plain, 70, 0.37);
  const plainMesh = new THREE.Mesh(plain, mats.grass);
  plainMesh.position.y = -0.14;
  plainMesh.receiveShadow = true;
  plainMesh.name = 'plain';
  g.add(plainMesh);

  // low white kerb defining the courtyard
  const kerb = new THREE.Mesh(new THREE.CylinderGeometry(112, 112.4, 0.32, 200, 1, true), mats.plasterWhite);
  kerb.position.y = 0.16;
  kerb.receiveShadow = true;
  tileUV(kerb.geometry, 120, 1);
  g.add(kerb);

  const ring = new THREE.Mesh(annulus(108, 112.4, 200), mats.plasterWhite);
  ring.position.y = 0.32;
  ring.receiveShadow = true;
  tileUV(ring.geometry, 60, 8);
  g.add(ring);

  return g;
}

function buildElephantWall(mats) {
  const g = new THREE.Group();
  g.name = 'elephant_wall';

  const h = D.wallTop;
  const r = D.wallR;

  // outer plastered face of the wall
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.22, h, 200, 1, true), mats.plaster);
  outer.position.y = h / 2;
  outer.receiveShadow = true;
  tileUV(outer.geometry, 40, 1.1);
  g.add(outer);

  // casting lip + the bright white band that runs above the elephants
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.5, 0.42, 200), mats.plasterWhite);
  lip.position.y = h - 0.21;
  lip.receiveShadow = true;
  lip.castShadow = true;
  tileUV(lip.geometry, 44, 1);
  g.add(lip);

  // coping course on top of the wall
  const coping = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.15, r + 0.55, 0.62, 200), mats.stone);
  coping.position.y = h + 0.31;
  coping.castShadow = true;
  coping.receiveShadow = true;
  tileUV(coping.geometry, 60, 1);
  g.add(coping);

  // low plinth the reliefs stand on
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.34, r + 0.5, 0.52, 200, 1, true), mats.plaster);
  plinth.position.y = 0.26;
  plinth.receiveShadow = true;
  tileUV(plinth.geometry, 50, 1);
  g.add(plinth);

  // paved floor of the ambulatory, between wall and masonry drum
  const floor = new THREE.Mesh(annulus(D.drumBaseR - 0.2, r - 0.15, 200), mats.stone);
  floor.position.y = D.terraceY;
  floor.receiveShadow = true;
  floor.name = 'terrace_paving';
  tileUV(floor.geometry, 46, 46);
  g.add(floor);

  // ---- the elephant reliefs ---------------------------------------------
  const plane = new THREE.PlaneGeometry(D.elephantW, D.elephantH, 1, 1);
  const baseY = 0.32 + D.elephantH / 2;
  const radius = r + 0.62;
  const parts = [];
  for (let i = 0; i < D.elephantCount; i++) {
    const phi = (i / D.elephantCount) * Math.PI * 2;
    const geo = plane.clone();
    geo.applyMatrix4(new THREE.Matrix4().makeRotationY(-phi + Math.PI / 2));
    geo.translate(Math.cos(phi) * radius, baseY, Math.sin(phi) * radius);
    parts.push(geo);
  }
  const elephants = new THREE.Mesh(mergeGeometries(parts, false), mats.elephant);
  elephants.name = 'elephant_reliefs';
  elephants.castShadow = true;
  elephants.receiveShadow = true;
  g.add(elephants);
  parts.forEach((p) => p.dispose());

  return g;
}

function buildDrum(mats) {
  const g = new THREE.Group();
  g.name = 'stone_drum';

  // battered masonry drum with three weathered courses
  const y0 = D.drumBaseY;
  const y1 = D.springY;
  const pts = [
    new THREE.Vector2(D.drumBaseR, y0),
    new THREE.Vector2(D.drumBaseR - 0.05, y0 + 1.15),
    new THREE.Vector2(D.drumBaseR - 0.55, y0 + 1.22),
    new THREE.Vector2(D.drumBaseR - 0.6, y0 + 1.25),
    new THREE.Vector2(D.drumBaseR - 1.25, y0 + 2.75),
    new THREE.Vector2(D.drumBaseR - 1.3, y0 + 2.8),
    new THREE.Vector2(D.drumTopR, y1 - 0.55),
    new THREE.Vector2(D.drumTopR - 0.5, y1),
  ];
  const geom = tileUV(lathe(pts, 200), 40, 1.5);
  g.add(mesh(geom, mats.stone, 'weathered_masonry'));

  // plaster coping ring between masonry and dome
  const cope = new THREE.Mesh(annulus(D.domeR - 0.4, D.drumTopR + 0.02, 200), mats.plaster);
  cope.position.y = y1 - 0.02;
  cope.receiveShadow = true;
  tileUV(cope.geometry, 60, 2);
  g.add(cope);

  return g;
}

function buildDome(mats) {
  const g = new THREE.Group();
  g.name = 'dome';

  // spherical cap: the silhouette fitted to the photograph
  const steps = 120;
  const pts = [new THREE.Vector2(D.domeR * 1.004, D.springY - 0.5)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // distribute samples by arc angle so the crown stays smooth
    const y = D.springY + D.domeH * Math.sin((t * Math.PI) / 2);
    pts.push(new THREE.Vector2(Math.max(domeRadiusAt(y), 0.03), y));
  }
  const shell = new THREE.Mesh(lathe(pts, 240), mats.dome);
  shell.name = 'whitewashed_dome';
  tileUV(shell.geometry, 13, 4.2);
  g.add(shell);

  // ---- red kasaya band ---------------------------------------------------
  const bY0 = D.springY + D.bandBottom;
  const bY1 = D.springY + D.bandTop;
  const bandPts = [new THREE.Vector2(domeRadiusAt(bY0) + 0.1, bY0)];
  for (let i = 1; i <= 10; i++) {
    const y = bY0 + ((bY1 - bY0) * i) / 10;
    bandPts.push(new THREE.Vector2(domeRadiusAt(y) + 0.1, y));
  }
  const band = new THREE.Mesh(lathe(bandPts, 240), mats.red);
  band.name = 'red_kasaya_band';
  band.receiveShadow = true;
  tileUV(band.geometry, 16, 1);
  g.add(band);

  // the golden fringe along the band's lower edge
  const fy0 = bY0 + 0.02;
  const fy1 = bY0 + 0.26;
  const fringePts = [];
  for (let i = 0; i <= 4; i++) {
    const y = fy0 + ((fy1 - fy0) * i) / 4;
    fringePts.push(new THREE.Vector2(domeRadiusAt(y) + 0.118, y));
  }
  const fringe = new THREE.Mesh(lathe(fringePts, 240), mats.gold);
  fringe.name = 'kasaya_fringe';
  tileUV(fringe.geometry, 60, 1);
  g.add(fringe);

  // the white piping beneath the cloth
  const lipPts = [
    new THREE.Vector2(domeRadiusAt(bY0 - 0.42) + 0.05, bY0 - 0.44),
    new THREE.Vector2(domeRadiusAt(bY0 - 0.02) + 0.115, bY0 + 0.02),
  ];
  const lip = new THREE.Mesh(lathe(lipPts, 240), mats.plaster);
  tileUV(lip.geometry, 60, 1);
  g.add(lip);

  return g;
}

function buildHarmika(mats) {
  const g = new THREE.Group();
  g.name = 'harmika';

  const s = D.harmikaSide;
  const y0 = D.harmikaPlinthY;

  // stepped plinth sinking into the dome crown
  const steps = [
    [s + 5.0, 0.62],
    [s + 3.2, 0.55],
    [s + 1.6, 0.5],
  ];
  let y = y0 - 1.0;
  steps.forEach(([side, h], i) => {
    const b = mesh(new THREE.BoxGeometry(side, h, side), i === 0 ? mats.stone : mats.plaster, 'harmika_plinth');
    b.position.y = y + h / 2;
    tileUV(b.geometry, 3, 0.5);
    g.add(b);
    y += h;
  });

  // fluted main block
  const blockH = D.harmikaTopY - y;
  const block = mesh(new THREE.BoxGeometry(s, blockH, s), mats.harmika, 'harmika_block');
  block.position.y = y + blockH / 2;
  tileUV(block.geometry, 2.2, 1.5);
  g.add(block);

  // vertical fluting across every face of the fluted block
  const fluteCount = 22;
  const fluteGeo = new THREE.BoxGeometry(0.34, blockH * 0.92, 0.22);
  for (let face = 0; face < 4; face++) {
    for (let i = 0; i < fluteCount; i++) {
      const u = (i + 0.5) / fluteCount - 0.5;
      const flute = new THREE.Mesh(fluteGeo.clone(), mats.plasterWhite);
      flute.name = 'harmika_flute';
      const off = s / 2 + 0.1;
      const along = u * (s - 1.2);
      if (face === 0) flute.position.set(along, block.position.y, off);
      if (face === 1) flute.position.set(along, block.position.y, -off);
      if (face === 2) flute.position.set(off, block.position.y, along);
      if (face === 3) flute.position.set(-off, block.position.y, along);
      if (face >= 2) flute.rotation.y = Math.PI / 2;
      tileUV(flute.geometry, 0.3, 1.2);
      g.add(flute);
    }
  }

  // corner pilasters
  const stripGeo = new THREE.BoxGeometry(1.05, blockH, 1.05);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strip = mesh(stripGeo.clone(), mats.plaster, 'harmika_pilaster');
    strip.position.set(Math.cos(ang) * s * 0.63, block.position.y, Math.sin(ang) * s * 0.63);
    tileUV(strip.geometry, 0.8, 1.2);
    g.add(strip);
  }

  // projecting cornice + neck
  const cor1 = mesh(new THREE.BoxGeometry(s + 3.6, 1.0, s + 3.6), mats.plaster, 'harmika_cornice');
  cor1.position.y = D.harmikaTopY + 0.47;
  tileUV(cor1.geometry, 2.6, 0.8);
  g.add(cor1);

  const cor2 = mesh(new THREE.BoxGeometry(s * 0.78, 0.7, s * 0.78), mats.plaster, 'harmika_cornice2');
  cor2.position.y = D.harmikaTopY + 1.25;
  tileUV(cor2.geometry, 2, 0.6);
  g.add(cor2);

  // lotus cushion that the spire rises from
  const cushion = mesh(
    lathe(
      [
        new THREE.Vector2(0.6, D.harmikaTopY + 1.55),
        new THREE.Vector2(5.6, D.harmikaTopY + 1.75),
        new THREE.Vector2(6.5, D.harmikaTopY + 2.2),
        new THREE.Vector2(5.3, D.harmikaTopY + 2.55),
        new THREE.Vector2(6.6, D.harmikaTopY + 2.85),
      ],
      120
    ),
    mats.plaster,
    'spire_cushion'
  );
  tileUV(cushion.geometry, 8, 1);
  g.add(cushion);

  return g;
}

function buildSpire(mats) {
  const g = new THREE.Group();
  g.name = 'spire';

  const H = D.spireTopY - D.spireBaseY;
  const steps = 220;
  const pts = [new THREE.Vector2(D.spireBaseR * 1.03, D.spireBaseY - 0.35)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // concave taper plus shallow horizontal ribs, as in the photograph
    const r = D.spireBaseR + (D.spireTopR - D.spireBaseR) * Math.pow(t, 0.95);
    const rib = 0.07 * Math.sin(t * Math.PI * 2 * 30) * (1 - t * 0.55);
    pts.push(new THREE.Vector2(Math.max(0.45, r + rib), D.spireBaseY + H * t));
  }
  const spire = mesh(lathe(pts, 160), mats.spire, 'conical_spire');
  tileUV(spire.geometry, 5, 26);
  g.add(spire);

  return g;
}

function buildFinial(mats) {
  const g = new THREE.Group();
  g.name = 'finial';

  const y0 = D.finialBaseY;
  // chudamanikya: bulb, narrowing neck, lotus, crystal tip
  const profile = [
    [0.05, 0.0],
    [1.95, 0.15],
    [2.45, 0.85],
    [2.6, 1.75],
    [2.15, 2.6],
    [1.2, 3.3],
    [1.0, 3.9],
    [1.65, 4.3],
    [1.85, 4.8],
    [1.4, 5.3],
    [0.8, 5.65],
    [0.95, 6.05],
    [0.55, 6.45],
    [0.22, 6.85],
    [0.06, 7.1],
  ];
  const finial = mesh(lathe(profile.map(([r, dy]) => new THREE.Vector2(r, y0 + dy)), 96), mats.gold, 'gilded_finial');
  tileUV(finial.geometry, 4, 1);
  g.add(finial);

  const tip = mesh(new THREE.SphereGeometry(0.28, 18, 12), mats.gold, 'finial_tip');
  tip.position.y = y0 + 7.3;
  g.add(tip);

  return g;
}

/* ---- front altar (asana), staircase and terrace paving ------------------ */

function buildFrontage(mats) {
  const g = new THREE.Group();
  g.name = 'frontage';

  const floorY = D.terraceY;

  // ---- the great flight: from the sand, up through the elephant wall ------
  const steps = 14;
  const run = 1.05;
  const rise = floorY / steps;
  const width = 12.0;

  const stair = new THREE.Group();
  stair.name = 'grand_staircase';
  for (let i = 0; i < steps; i++) {
    const hgt = rise * (i + 1);
    const box = new THREE.Mesh(new THREE.BoxGeometry(width, hgt, run + 0.02), mats.stone);
    box.position.set(0, hgt / 2, D.wallR + 0.4 + i * run);
    tileUV(box.geometry, 3.2, 0.25 + hgt / floorY);
    stair.add(box);
  }

  // sloped balustrades flanking the flight
  const flightLen = Math.hypot(steps * run, floorY);
  const slope = Math.atan2(floorY, steps * run);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, flightLen), mats.stone);
    cheek.position.set(
      side * (width / 2 + 0.65),
      floorY / 2 + 1.0,
      D.wallR + 0.4 + (steps * run) / 2
    );
    cheek.rotation.x = -slope;
    tileUV(cheek.geometry, 1.2, 1.6);
    stair.add(cheek);

    // moonstone (sandakadapahana) slab at the foot of each balustrade
    const moon = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 40, 1, false, 0, Math.PI), mats.stone);
    moon.rotation.x = -Math.PI / 2;
    moon.rotation.z = Math.PI;
    moon.position.set(side * (width / 2 + 0.65), 0.1, D.wallR + 0.2);
    stair.add(moon);
  }

  // landing where the flight meets the terrace
  const landing = new THREE.Mesh(new THREE.BoxGeometry(width + 3.2, 0.32, 2.4), mats.stone);
  landing.position.set(0, floorY - 0.16, D.wallR - 1.0);
  tileUV(landing.geometry, 4, 0.4);
  stair.add(landing);
  g.add(stair);

  // ---- the altar (asana) against the drum --------------------------------
  const altar = new THREE.Group();
  altar.name = 'altar';
  const zc = D.drumBaseR - 1.4;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(17, 1.1, 9.0), mats.stone);
  plinth.position.set(0, floorY + 0.55, zc);
  tileUV(plinth.geometry, 4, 0.8);
  altar.add(plinth);

  const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.1, 7.4), mats.plasterWhite);
  plinth2.position.set(0, floorY + 1.65, zc);
  tileUV(plinth2.geometry, 4, 0.8);
  altar.add(plinth2);

  const py = floorY + 2.2;
  const smallR = 2.9;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(smallR, smallR + 0.24, 1.35, 64), mats.plasterWhite);
  drum.position.set(0, py + 0.67, zc);
  tileUV(drum.geometry, 5, 1);
  altar.add(drum);

  const domePts = [];
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * (Math.PI / 2);
    domePts.push(new THREE.Vector2(Math.max(0.02, smallR * Math.cos(a)), py + 1.35 + 3.0 * Math.sin(a)));
  }
  const smallDome = new THREE.Mesh(lathe(domePts, 64), mats.plasterWhite);
  smallDome.position.z = zc;
  tileUV(smallDome.geometry, 4, 2);
  altar.add(smallDome);

  const smallBox = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.9), mats.plasterWhite);
  smallBox.position.set(0, py + 4.6, zc);
  tileUV(smallBox.geometry, 1, 0.5);
  altar.add(smallBox);

  const smallSpire = new THREE.Mesh(new THREE.ConeGeometry(0.78, 2.9, 32), mats.plasterWhite);
  smallSpire.position.set(0, py + 6.4, zc);
  tileUV(smallSpire.geometry, 3, 2);
  altar.add(smallSpire);

  const smallTip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), mats.gold);
  smallTip.position.set(0, py + 7.95, zc);
  altar.add(smallTip);

  g.add(altar);

  // ---- lamp posts flanking the approach ---------------------------------
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 9.2, 16), mats.plasterWhite);
    post.position.set(side * 20.5, 4.6, D.wallR + 6.5);
    g.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), mats.plasterWhite);
    lamp.position.set(side * 20.5, 9.4, D.wallR + 6.5);
    g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 16), mats.plasterWhite);
    cap.position.set(side * 20.5, 10.1, D.wallR + 6.5);
    g.add(cap);
  }

  return g;
}

/* ---- distant vegetation ring framing the courtyard ---------------------- */

function buildTrees(rng) {
  const g = new THREE.Group();
  g.name = 'treeline';

  const trunkParts = [];
  const canopyA = [];
  const canopyB = [];
  const count = 260;

  for (let i = 0; i < count; i++) {
    const phi = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.09;
    // leave the approach avenue clear, as the temple's own courtyard does
    const toFront = Math.abs(Math.atan2(Math.sin(phi - Math.PI / 2), Math.cos(phi - Math.PI / 2)));
    if (toFront < 0.62) continue;
    const dist = 205 + rng() * 250;
    const x = Math.cos(phi) * dist;
    const z = Math.sin(phi) * dist;
    const h = 10 + rng() * 13;
    const rad = 5.0 + rng() * 4.2;

    const trunk = new THREE.CylinderGeometry(0.45, 0.8, h * 0.6, 6, 1);
    trunk.translate(x, h * 0.3, z);
    trunkParts.push(trunk);

    // a palm-like/rounded crown: three flattened, overlapping blobs
    for (let k = 0; k < 3; k++) {
      const r = rad * (1 - k * 0.14);
      const blob = new THREE.IcosahedronGeometry(r, 0);
      blob.scale(1, 0.85, 1);
      blob.translate(
        x + (rng() - 0.5) * rad * 0.9,
        h * 0.55 + k * rad * 0.42,
        z + (rng() - 0.5) * rad * 0.9
      );
      (k % 2 === 0 ? canopyA : canopyB).push(blob);
    }
  }

  const trunks = new THREE.Mesh(
    mergeGeometries(trunkParts, false),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 })
  );
  trunks.name = 'tree_trunks';
  g.add(trunks);

  const a = new THREE.Mesh(
    mergeGeometries(canopyA, false),
    new THREE.MeshStandardMaterial({ color: 0x4a6a3e, roughness: 0.95, flatShading: true })
  );
  a.name = 'tree_canopy_a';
  g.add(a);

  const b = new THREE.Mesh(
    mergeGeometries(canopyB, false),
    new THREE.MeshStandardMaterial({ color: 0x36502f, roughness: 0.95, flatShading: true })
  );
  b.name = 'tree_canopy_b';
  g.add(b);

  return g;
}

/* ------------------------------------------------------------------------- */
/*  Assembly                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Build the whole monument.
 * @param {Record<string, THREE.Material>} mats
 * @param {{trees?: boolean}} opts
 * @returns {THREE.Group}
 */
export function buildMonument(mats, opts = {}) {
  const root = new THREE.Group();
  root.name = 'Ruwanwelisaya_Maha_Seya';

  root.add(buildCourtyard(mats));
  root.add(buildElephantWall(mats));
  root.add(buildDrum(mats));
  root.add(buildDome(mats));
  root.add(buildHarmika(mats));
  root.add(buildSpire(mats));
  root.add(buildFinial(mats));
  root.add(buildFrontage(mats));

  if (opts.trees !== false) {
    root.add(buildTrees(mulberry32(20260101)));
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return root;
}

export { mergeGeometries };

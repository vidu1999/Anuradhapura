/**
 * TRELLIS image → 3D — browser client.
 *
 * Upload one image, poll the job, then show the returned GLB in three.js.
 * The server does all the generation; this file is only UI + viewing.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);

const els = {
  statusChip: $('statusChip'),
  statusDetail: $('statusDetail'),
  banner: $('banner'),
  bannerText: $('bannerText'),
  dropzone: $('dropzone'),
  fileInput: $('fileInput'),
  thumb: $('thumb'),
  dropEmpty: $('dropEmpty'),
  clearBtn: $('clearBtn'),
  resetBtn: $('resetBtn'),
  generateBtn: $('generateBtn'),
  progressWrap: $('progressWrap'),
  progressFill: $('progressFill'),
  progressStage: $('progressStage'),
  progressPct: $('progressPct'),
  log: $('log'),
  viewer: $('viewer'),
  viewerEmpty: $('viewerEmpty'),
  downloads: $('downloads'),
  downloadGlb: $('downloadGlb'),
  downloadPly: $('downloadPly'),
  downloadPreview: $('downloadPreview'),
  stats: $('stats'),
  modelName: $('modelName'),
  turntableBtn: $('turntableBtn'),
  wireBtn: $('wireBtn'),
  gridBtn: $('gridBtn'),
  resetViewBtn: $('resetViewBtn'),
};

const options = {
  seed: $('seed'),
  textureSize: $('textureSize'),
  ssSteps: $('ssSteps'),
  ssCfg: $('ssCfg'),
  slatSteps: $('slatSteps'),
  slatCfg: $('slatCfg'),
  simplify: $('simplify'),
  exportPly: $('exportPly'),
};

const DEFAULTS = {};
Object.entries(options).forEach(([key, el]) => {
  DEFAULTS[key] = el.type === 'checkbox' ? el.checked : el.value;
});

const state = {
  file: null,
  health: null,
  job: null,
  polling: null,
  model: null,
  turntable: true,
  wireframe: false,
  grid: true,
};

/* ------------------------------------------------------------------------- */
/*  three.js viewer                                                          */
/* ------------------------------------------------------------------------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
els.viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(2.4, 3.6, 2.8);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9ec3ff, 1.0);
fill.position.set(-2.6, 1.2, -2.2);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x1a222c, 0.7));

const grid = new THREE.GridHelper(4, 20, 0x2f3d4b, 0x1d262f);
grid.position.y = -1.02;
scene.add(grid);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.6;
controls.minDistance = 1.2;
controls.maxDistance = 12;
controls.autoRotate = state.turntable;

const modelRoot = new THREE.Group();
scene.add(modelRoot);

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

  object.position.sub(center);
  const normalise = 1.6 / radius; // keep every result the same on-screen size
  object.scale.setScalar(normalise);
  object.position.multiplyScalar(normalise);

  grid.position.y = -1.0 * (size.y * normalise) / 2 - 0.02;

  camera.position.set(2.1, 1.35, 2.6);
  controls.target.set(0, 0, 0);
  controls.update();
  return { size, radius };
}

function loadGlb(url) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        if (state.model) {
          modelRoot.remove(state.model);
          disposeTree(state.model);
        }
        state.model = gltf.scene;
        state.model.traverse((child) => {
          if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((m) => {
              m.wireframe = state.wireframe;
              if (m.map) m.map.anisotropy = 8;
            });
          }
        });
        modelRoot.add(state.model);
        els.viewerEmpty.hidden = true;
        resolve(gltf);
      },
      undefined,
      reject
    );
  });
}

function disposeTree(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials?.forEach((m) => {
      Object.values(m).forEach((value) => {
        if (value && value.isTexture) value.dispose();
      });
      m.dispose?.();
    });
  });
}

function resize() {
  const rect = els.viewer.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(els.viewer);

function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
resize();
tick();

/* ------------------------------------------------------------------------- */
/*  Health                                                                   */
/* ------------------------------------------------------------------------- */

async function loadHealth() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    state.health = health;

    const backend = health.backend;
    const status = health.status || {};
    els.modelName.textContent = status.model || 'microsoft/TRELLIS-image-large';

    if (backend === 'trellis') {
      els.statusChip.textContent = 'GPU ready';
      els.statusChip.className = 'chip chip--ok';
      els.statusDetail.textContent = `${status.gpu || 'CUDA'}${status.vram_gb ? ` · ${status.vram_gb} GB` : ''}`;
      els.banner.hidden = true;
    } else {
      els.statusChip.textContent = 'smoke test';
      els.statusChip.className = 'chip chip--warn';
      els.statusDetail.textContent = 'no CUDA GPU on this host';
      els.banner.hidden = false;
      els.bannerText.textContent =
        'This host has no NVIDIA GPU, so the service cannot run TRELLIS inference. ' +
        'Uploads are still processed end-to-end and return a placeholder GLB so you can ' +
        'verify the pipeline — run the same container on a CUDA machine (≥16 GB VRAM) for real results.';
    }
    els.generateBtn.disabled = !state.file;
  } catch (error) {
    els.statusChip.textContent = 'offline';
    els.statusChip.className = 'chip chip--err';
    els.statusDetail.textContent = String(error.message || error);
  }
}

/* ------------------------------------------------------------------------- */
/*  Upload                                                                   */
/* ------------------------------------------------------------------------- */

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return;
  }
  state.file = file;
  const url = URL.createObjectURL(file);
  els.thumb.src = url;
  els.thumb.hidden = false;
  els.dropEmpty.hidden = true;
  els.clearBtn.hidden = false;
  els.generateBtn.disabled = false;
}

function clearFile() {
  state.file = null;
  els.thumb.hidden = true;
  els.thumb.src = '';
  els.dropEmpty.hidden = false;
  els.clearBtn.hidden = true;
  els.generateBtn.disabled = true;
  els.fileInput.value = '';
}

els.dropzone.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', (event) => setFile(event.target.files?.[0]));
els.clearBtn.addEventListener('click', (event) => {
  event.preventDefault();
  clearFile();
});

['dragenter', 'dragover'].forEach((type) =>
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('is-over');
  })
);
['dragleave', 'drop'].forEach((type) =>
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('is-over');
  })
);
els.dropzone.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));

// paste an image straight from the clipboard
window.addEventListener('paste', (event) => {
  const item = [...(event.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) setFile(item.getAsFile());
});

els.resetBtn.addEventListener('click', () => {
  Object.entries(options).forEach(([keyName, el]) => {
    if (el.type === 'checkbox') el.checked = DEFAULTS[keyName];
    else el.value = DEFAULTS[keyName];
  });
});

/* ------------------------------------------------------------------------- */
/*  Generate                                                                 */
/* ------------------------------------------------------------------------- */

function fmt(value) {
  return value === undefined || value === null ? '—' : value;
}

function renderStats(job) {
  const stats = job.stats || {};
  const timings = stats.timings || {};
  const rows = [
    ['Backend', stats.backend === 'mock' ? 'smoke test' : 'TRELLIS'],
    ['Faces', stats.mesh_faces ? Number(stats.mesh_faces).toLocaleString() : '—'],
    ['Voxels', stats.voxels ? Number(stats.voxels).toLocaleString() : '—'],
    ['Texture', stats.texture_size ? `${stats.texture_size} px` : '—'],
    ['Seed', fmt(stats.seed)],
    ['Run time', job.timings?.run_seconds != null ? `${job.timings.run_seconds}s` : timings.total ? `${timings.total}s` : '—'],
  ];
  els.stats.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
  els.stats.hidden = false;
}

function setProgress(job) {
  const pct = Math.round((job.progress || 0) * 100);
  els.progressWrap.hidden = false;
  els.progressFill.style.width = `${pct}%`;
  els.progressPct.textContent = `${pct}%`;
  els.progressStage.textContent = job.error ? job.error : job.stage || job.status;
  if (job.log?.length) {
    els.log.hidden = false;
    els.log.textContent = job.log.join('\n');
    els.log.scrollTop = els.log.scrollHeight;
  }
}

async function poll(jobId) {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) throw new Error(`job lookup failed (${response.status})`);
  const job = await response.json();
  state.job = job;
  setProgress(job);

  if (job.status === 'succeeded') {
    els.generateBtn.disabled = false;
    const glbUrl = job.files.glb;
    if (glbUrl) {
      await loadGlb(`${glbUrl}?t=${Date.now()}`);
      frameObject(modelRoot);
      els.downloads.hidden = false;
      els.downloadGlb.href = glbUrl;
      els.downloadGlb.setAttribute('download', 'model.glb');

      const plyUrl = job.files.ply;
      els.downloadPly.hidden = !plyUrl;
      if (plyUrl) {
        els.downloadPly.href = plyUrl;
        els.downloadPly.setAttribute('download', 'model.ply');
      }
      const previewUrl = job.files.preview;
      els.downloadPreview.hidden = !previewUrl;
      if (previewUrl) {
        els.downloadPreview.href = previewUrl;
        els.downloadPreview.setAttribute('download', 'preview.png');
      }
    }
    renderStats(job);
    return;
  }

  if (job.status === 'failed') {
    els.generateBtn.disabled = false;
    els.progressFill.style.width = '100%';
    els.progressFill.style.background = 'linear-gradient(90deg,#f2777a,#f0b567)';
    els.progressStage.textContent = job.error || 'generation failed';
    return;
  }

  state.polling = setTimeout(() => poll(jobId).catch(showError), 900);
}

function showError(error) {
  clearTimeout(state.polling);
  els.generateBtn.disabled = false;
  els.progressWrap.hidden = false;
  els.progressStage.textContent = String(error.message || error);
  els.progressFill.style.background = 'linear-gradient(90deg,#f2777a,#f0b567)';
  console.error(error);
}

els.generateBtn.addEventListener('click', async () => {
  if (!state.file) return;
  clearTimeout(state.polling);
  els.generateBtn.disabled = true;
  els.progressFill.style.width = '0%';
  els.progressFill.style.background = 'linear-gradient(90deg,#4f9cf9,#6ee7b7)';
  els.progressStage.textContent = 'uploading…';
  els.progressWrap.hidden = false;
  els.log.hidden = true;
  els.log.textContent = '';

  const form = new FormData();
  form.append('image', state.file, state.file.name || 'upload.png');
  form.append('seed', options.seed.value);
  form.append('texture_size', options.textureSize.value);
  form.append('ss_steps', options.ssSteps.value);
  form.append('ss_cfg', options.ssCfg.value);
  form.append('slat_steps', options.slatSteps.value);
  form.append('slat_cfg', options.slatCfg.value);
  form.append('simplify', options.simplify.value);
  form.append('export_ply', options.exportPly.checked ? 'true' : 'false');

  try {
    const response = await fetch('/api/generate', { method: 'POST', body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `request failed (${response.status})`);
    poll(payload.id).catch(showError);
  } catch (error) {
    showError(error);
  }
});

/* ------------------------------------------------------------------------- */
/*  Viewer tools                                                             */
/* ------------------------------------------------------------------------- */

els.turntableBtn.classList.toggle('is-active', state.turntable);
els.turntableBtn.addEventListener('click', () => {
  state.turntable = !state.turntable;
  controls.autoRotate = state.turntable;
  els.turntableBtn.classList.toggle('is-active', state.turntable);
});

els.wireBtn.addEventListener('click', () => {
  state.wireframe = !state.wireframe;
  els.wireBtn.classList.toggle('is-active', state.wireframe);
  modelRoot.traverse((child) => {
    if (child.isMesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => {
        m.wireframe = state.wireframe;
      });
    }
  });
});

els.gridBtn.classList.toggle('is-active', state.grid);
els.gridBtn.addEventListener('click', () => {
  state.grid = !state.grid;
  grid.visible = state.grid;
  els.gridBtn.classList.toggle('is-active', state.grid);
});

els.resetViewBtn.addEventListener('click', () => {
  camera.position.set(2.1, 1.35, 2.6);
  controls.target.set(0, 0, 0);
  controls.update();
});

loadHealth();
setInterval(loadHealth, 20000);

import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist');
await mkdir('public/maplibre', { recursive: true });
await copyFile(join(dist, 'maplibre-gl-worker.mjs'), 'public/maplibre/maplibre-gl-worker.mjs');

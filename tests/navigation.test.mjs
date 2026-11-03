import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('navigation uses a same-origin worker, a real route and a speed-gated avatar',()=>{
 const navigation=readFileSync('src/components/NavigationMap.tsx','utf8');
 const worker=readFileSync('public/maplibre/maplibre-gl-worker.mjs');
 assert.match(navigation,/setWorkerUrl\('\/maplibre\/maplibre-gl-worker\.mjs'\)/);
 assert.match(navigation,/p\.speed>=\.5/);
 assert.match(navigation,/coordinates:route\.points\.map/);
 assert.ok(worker.length>0);
});

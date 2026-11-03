import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('navigation uses a same-origin worker, a real route and a speed-gated avatar',()=>{
 const navigation=readFileSync('src/components/NavigationMap.tsx','utf8');
 const worker=readFileSync('public/maplibre/maplibre-gl-worker.mjs');
 assert.match(navigation,/setWorkerUrl\('\/maplibre\/maplibre-gl-worker\.mjs'\)/);
 assert.match(navigation,/characterMotion\(p\.speed\)/);
 assert.match(navigation,/coordinates:route\.points\.map/);
 assert.ok(worker.length>0);
});
test('OSM building data is used for actual 3D extrusions with attribution',()=>{
 const source=readFileSync('src/components/NavigationMap.tsx','utf8');
 assert.match(source,/https:\/\/tiles\.openfreemap\.org\/planet/);
 assert.match(source,/type:'fill-extrusion'/);
 assert.match(source,/'source-layer':'building'/);
 assert.match(source,/'get','render_height'/);
 assert.match(source,/openstreetmap\.org\/copyright/);
 assert.match(source,/coverage and heights may be approximate/);
});
test('character marker has a decorative green halo without changing GPS position',()=>{
 const navigation=readFileSync('src/components/NavigationMap.tsx','utf8');
 const css=readFileSync('src/app/globals.css','utf8');
 assert.match(navigation,/element:avatar\.current\.marker/);
 assert.match(navigation,/marker\.appendChild\(canvas\)/);
 assert.match(css,/\.navigation-avatar-marker::before\{[^}]*border-radius:50%/);
 assert.match(css,/not a GPS accuracy indicator/);
});

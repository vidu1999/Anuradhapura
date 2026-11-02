import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
test('foundation keeps spatial index and default-deny RLS',()=>{const sql=readFileSync('supabase/migrations/20261101000000_foundation.sql','utf8');assert.match(sql,/using gist\(location\)/i);assert.match(sql,/enable row level security/i);assert.match(sql,/state='published'/i)});
test('starter collection declares no coordinates',()=>{const data=readFileSync('lib/sites.ts','utf8');assert.doesNotMatch(data,/latitude\s*:/i);assert.doesNotMatch(data,/longitude\s*:/i);assert.match(data,/whc\.unesco\.org/)});
test('map worker is served locally and generated from installed MapLibre',()=>{const map=readFileSync('app/map/MapExperience.tsx','utf8');const worker=readFileSync('public/maplibre/maplibre-gl-worker.mjs');const installed=readFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');assert.match(map,/setWorkerUrl\('\/maplibre\/maplibre-gl-worker\.mjs'\)/);assert.deepEqual(worker,installed)});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Ruwanwelisaya GLB is present and its required Draco decoder is configured',()=>{
  const model=readFileSync('public/models/ruwanwelisaya.glb');
  assert.equal(model.toString('ascii',0,4),'glTF');
  assert.equal(model.readUInt32LE(4),2);
  assert.equal(model.readUInt32LE(8),model.length);
  const json=JSON.parse(model.toString('utf8',20,20+model.readUInt32LE(12)));
  assert.ok(json.meshes?.length);
  assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'));
  assert.match(readFileSync('src/data/sites.ts','utf8'),/modelUrl:'\/models\/ruwanwelisaya\.glb'/);
  assert.match(readFileSync('src/components/MonumentViewer.tsx','utf8'),/setDRACOLoader\(draco\)/);
  assert.ok(readFileSync('public/draco/draco_decoder.wasm').length>0);
});

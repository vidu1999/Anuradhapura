import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('all mapped pins share the anchored popup, with models only when present',()=>{
 const map=readFileSync('src/components/HeritageMap.tsx','utf8');const popup=readFileSync('src/components/SitePopup.tsx','utf8');
 assert.match(map,/sites\.filter\(hasCoordinates\)/);assert.match(map,/<Popup className="heritage-model-popup"/);assert.match(map,/<SitePopup site=\{s\}/);
 assert.match(popup,/if\(site\.modelUrl\)return <MonumentViewer inline/);assert.match(popup,/site\.name/);assert.match(popup,/site\.category/);assert.match(popup,/AI-GENERATED ILLUSTRATION/);assert.match(popup,/not a site photograph or reconstruction/);
});

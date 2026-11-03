import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
test('six source-linked starter records',()=>{const data=readFileSync('src/data/sites.ts','utf8');assert.equal((data.match(/source:'https:/g)||[]).length,6);assert.match(data,/approximate map points/)});
test('distance and location consent are explicitly labelled',()=>{const map=readFileSync('src/components/HeritageMap.tsx','utf8');assert.match(map,/STRAIGHT-LINE DISTANCE/);assert.match(map,/watchPosition/);assert.match(map,/clearWatch/)});

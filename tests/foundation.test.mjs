import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/data/sites.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {heritageSites,hasCoordinates}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('all 30 requested locations are catalogued without duplicate ids',()=>{assert.equal(heritageSites.length,30);assert.equal(new Set(heritageSites.map(s=>s.id)).size,30);assert.ok(heritageSites.every(s=>s.source?.startsWith('http')))});
test('unverified places have no invented coordinates',()=>{const unknown=heritageSites.filter(s=>!hasCoordinates(s));assert.ok(unknown.length>0);assert.ok(unknown.every(s=>s.latitude===null&&s.longitude===null));assert.equal(heritageSites.find(s=>s.id==='dalada-maligawa').latitude,null)});
test('distance and location consent are explicitly labelled',()=>{const map=readFileSync('src/components/HeritageMap.tsx','utf8');assert.match(map,/STRAIGHT-LINE DISTANCE/);assert.match(map,/watchPosition/);assert.match(map,/clearWatch/);assert.match(map,/sites\.filter\(hasCoordinates\)/)});

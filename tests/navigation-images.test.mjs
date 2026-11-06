import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/data/navigation-images.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {navigationImages,navigationPhotos}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('destination artwork is unique and exists',()=>{assert.equal(new Set(Object.values(navigationImages)).size,Object.keys(navigationImages).length);for(const image of Object.values(navigationImages))assert.ok(existsSync(`public${image}`))});
test('five photo-referenced scenes have unique artwork and reference credits',()=>{for(const id of ['ruwan','mirisaveti','jetavana','abhaya','thuparamaya']){assert.match(navigationImages[id],/-reference\.png$/);const source=navigationPhotos[id];assert.ok(source.credit&&source.source&&source.license&&source.licenseUrl)}});
test('navigation uses site artwork and labels AI images, with attribution links',()=>{const nav=readFileSync('src/components/ImmersiveNavigation.tsx','utf8');assert.match(nav,/navigationImages\[site.id\]/);assert.match(nav,/AI-GENERATED SCENE/);assert.match(nav,/NOT A PHOTO, VERIFIED RECONSTRUCTION/);assert.match(nav,/reference\.licenseUrl/);assert.doesNotMatch(nav,/navigation-photo"/)});

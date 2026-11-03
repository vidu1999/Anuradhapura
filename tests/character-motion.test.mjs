import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/data/character-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {characterMotion,findMotionClips}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('unknown, invalid and stationary speed use wait',()=>{for(const speed of [null,undefined,NaN,Infinity,-1,0,.49])assert.equal(characterMotion(speed),'wait')});
test('reported speed selects walk and run without claiming transport mode',()=>{assert.equal(characterMotion(.5),'walk');assert.equal(characterMotion(2.99),'walk');assert.equal(characterMotion(3),'run');assert.equal(characterMotion(20),'run')});
test('clips must be named for their motion',()=>{const clips=[{name:'Wait'},{name:'Walking'},{name:'Running'}];assert.deepEqual(findMotionClips(clips),{wait:clips[0],walk:clips[1],run:clips[2]});assert.equal(findMotionClips([{name:'Animation'}]).run,undefined)});
test('supplied GLB contains usable idle, walk and run animation tracks',()=>{
 const buffer=readFileSync('public/models/malecharacter.glb');assert.equal(buffer.toString('ascii',0,4),'glTF');
 const length=buffer.readUInt32LE(12);const gltf=JSON.parse(buffer.subarray(20,20+length).toString('utf8'));
 assert.ok(gltf.skins?.length);const clips=findMotionClips(gltf.animations??[]);
 assert.equal(clips.wait?.name,'idle');assert.equal(clips.walk?.name,'walk');assert.equal(clips.run?.name,'run');
 for(const clip of [clips.wait,clips.walk,clips.run])assert.ok(clip.channels?.length>0);
});

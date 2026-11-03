import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/lib/gemini.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {readGeminiText,readGeminiImage,geminiError}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('reads Gemini response text and safe image data',()=>{const data={candidates:[{content:{parts:[{text:'Hello'},{inlineData:{mimeType:'image/png',data:'YWJj'}}]}}]};assert.equal(readGeminiText(data),'Hello');assert.equal(readGeminiImage(data),'data:image/png;base64,YWJj');assert.equal(readGeminiImage({candidates:[{content:{parts:[{inlineData:{mimeType:'image/svg+xml',data:'YWJj'}}]}}]}),null);assert.equal(readGeminiImage({}),null)});
test('errors are safe and do not expose server secrets',()=>{assert.match(geminiError(429),/quota/i);assert.match(geminiError(403),/restrictions/i);assert.doesNotMatch(geminiError(500),/key=/)});
test('server limits generation to known catalog records and does not expose the key',()=>{const route=readFileSync('src/app/api/place-experience/route.ts','utf8');const client=readFileSync('src/components/PlaceExperience.tsx','utf8');assert.match(route,/heritageSites\.find/);assert.match(route,/process\.env\.GEMINI_API_KEY/);assert.match(route,/x-goog-api-key/);assert.doesNotMatch(client,/GEMINI_API_KEY/);assert.match(client,/AI-GENERATED/);assert.match(client,/not a photograph or verified reconstruction/)});

test('Google structured reason codes give actionable diagnostics without echoing provider messages',()=>{
 const err=(reason)=>({error:{message:'secret DO NOT ECHO',details:[{reason,metadata:{key:'secret'}}]}});
 assert.match(geminiError(403,err('API_KEY_HTTP_REFERRER_BLOCKED')),/referrer/i);
 assert.match(geminiError(403,err('SERVICE_DISABLED')),/disabled/i);
 assert.match(geminiError(400,err('API_KEY_INVALID')),/invalid/i);
 assert.match(geminiError(403,err('API_KEY_SERVICE_BLOCKED')),/API restrictions/i);
 assert.doesNotMatch(geminiError(403,err('UNEXPECTED_SECRET')),/secret/i);
});

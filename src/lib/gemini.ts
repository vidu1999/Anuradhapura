/** Server-only Gemini response parsing and safe error handling. */
export type GeminiPart = {text?:unknown;inlineData?:{mimeType?:unknown;data?:unknown}};
export type GeminiResponse = {candidates?:Array<{content?:{parts?:GeminiPart[]}}>};
export function readGeminiText(result:GeminiResponse):string|null {
 const text=result.candidates?.flatMap(candidate=>candidate.content?.parts??[]).map(part=>typeof part.text==='string'?part.text:'').join('\n').trim();
 return text ? text.slice(0,4000) : null;
}
export function readGeminiImage(result:GeminiResponse):string|null {
 const parts=result.candidates?.flatMap(candidate=>candidate.content?.parts??[])??[];
 for(const part of parts){const data=part.inlineData?.data;const mime=part.inlineData?.mimeType;if(typeof data==='string'&&data.length<=12_000_000&&/^[A-Za-z0-9+/]+={0,2}$/.test(data)&&(mime==='image/png'||mime==='image/jpeg'||mime==='image/webp'))return `data:${mime};base64,${data}`}
 return null;
}
export function geminiError(status:number):string {
 if(status===429)return 'Gemini quota or rate limit reached. Try again later.';
 if(status===401||status===403)return 'Gemini rejected the server API key or access to this model. Check the server configuration.';
 return 'Gemini could not complete this request. Please try again later.';
}

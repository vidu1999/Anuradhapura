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
/** Only expose known reason codes; Google error messages and metadata may contain secrets. */
export function geminiError(status:number,body?:unknown):string {
 const error=body&&typeof body==='object'?(body as {error?:{details?:unknown}}).error:undefined;
 const details=Array.isArray(error?.details)?error.details:[];
 const reasons=details.flatMap((detail:unknown)=>detail&&typeof detail==='object'&&typeof (detail as {reason?:unknown}).reason==='string'?[(detail as {reason:string}).reason]:[]);
 if(reasons.includes('API_KEY_INVALID'))return 'Google reports the API key is invalid. Check the Gemini API key in .env.local and restart the server.';
 if(reasons.includes('API_KEY_HTTP_REFERRER_BLOCKED'))return 'Google blocked this key’s website-referrer restriction. Server-side Gemini calls have no browser referrer; use a key configured for server requests.';
 if(reasons.includes('API_KEY_IP_ADDRESS_BLOCKED'))return 'Google blocked the server’s IP address. Check the key’s IP restrictions for this server.';
 if(reasons.includes('API_KEY_SERVICE_BLOCKED'))return 'This key is not allowed to call the Generative Language API. Check its API restrictions in Google Cloud.';
 if(reasons.includes('SERVICE_DISABLED'))return 'The Generative Language API is disabled for this Google Cloud project. Enable it and retry after changes propagate.';
 if(status===429)return 'Gemini quota or rate limit reached. Try again later.';
 if(status===401)return 'Google could not authenticate this API key. Check the Gemini key and server configuration.';
 if(status===403)return 'Google denied access (HTTP 403). Check API key restrictions, Generative Language API access, billing and regional availability.';
 if(status===404)return 'Google could not find or provide access to this model (HTTP 404). Check model availability for your account.';
 if(status===400)return 'Google rejected the request (HTTP 400). Check the key, model availability and request settings.';
 return `Gemini could not complete this request (HTTP ${Number.isInteger(status)&&status>=100&&status<=599?status:'error'}). Please try again later.`;
}

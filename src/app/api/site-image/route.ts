import { heritageSites } from '@/data/sites';
import { createRateLimiter } from '@/lib/ai-guide';
import { generateSiteImage, imageError } from '@/lib/site-image';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Prototype-only process-wide limit; public deployments require auth, distributed limits and budgets.
const allow=createRateLimiter(3,60_000);
const json=(data:object,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const modelPattern=/^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._:-]{0,127}$/i;
async function readBody(request:Request):Promise<unknown>{
 if(Number(request.headers.get('content-length'))>4096)throw new Error('large');
 if(!request.body)throw new Error('invalid');const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error('large')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Cross-site requests are not allowed.'},403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Content-Type must be application/json.'},415);
 let body:unknown;try{body=await readBody(request)}catch(e){return json({error:'Invalid or oversized request.'},e instanceof Error&&e.message==='large'?413:400)}
 const id=body&&typeof body==='object'?(body as {siteId?:unknown}).siteId:null;
 if(typeof id!=='string'||id.length>100)return json({error:'Choose a valid catalog site.'},400);
 const site=heritageSites.find(item=>item.id===id);if(!site)return json({error:'Site not found.'},404);
 if(site.modelUrl)return json({error:'This site already has a 3D model.'},400);
 const key=process.env.OPENROUTER_API_KEY?.trim();if(!key)return json({error:'Set OPENROUTER_API_KEY on the server and restart.'},503);
 const textModel=process.env.OPENROUTER_IMAGE_TEXT_MODEL?.trim()||'openai/gpt-4o-mini';const imageModel=process.env.OPENROUTER_IMAGE_MODEL?.trim()||'google/gemini-2.5-flash-image';
 if(!modelPattern.test(textModel)||!modelPattern.test(imageModel))return json({error:'Image model configuration is invalid.'},503);
 if(!allow())return json({error:'Image generation is busy. Please wait a minute and try again.'},429);
 try{const image=await generateSiteImage({key,textModel,imageModel,site,signal:AbortSignal.timeout(120_000)});if(!image)return json({error:'The image tool did not return a supported image. Try again or check model access.'},502);return json({image},200)}catch(error){const status=typeof error==='object'&&error!==null&&'status'in error&&typeof error.status==='number'?error.status:0;return json({error:status?imageError(status):'Could not reach OpenRouter or the image request timed out.'},status===429?429:502)}
}

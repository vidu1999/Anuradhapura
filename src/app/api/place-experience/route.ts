import { NextResponse } from 'next/server';
import { heritageSites } from '@/data/sites';
import { geminiError, readGeminiImage, readGeminiText, type GeminiResponse } from '@/lib/gemini';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
type Result={value:string|null;error:string|null};
async function generate(key:string,model:string,prompt:string,image:boolean):Promise<Result>{
 try {
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:image?{responseModalities:['TEXT','IMAGE']}:{maxOutputTokens:800,temperature:0.2}}),
   signal:AbortSignal.timeout(90_000),cache:'no-store'
  });
  if(!response.ok){let details:unknown;try{details=await response.json()}catch{}return {value:null,error:geminiError(response.status,details)}}
  const data=await response.json() as GeminiResponse;
  const value=image?readGeminiImage(data):readGeminiText(data);
  return value?{value,error:null}:{value:null,error:`Gemini did not return ${image?'an image':'text'} for this request.`};
 }catch{return {value:null,error:'Could not reach Gemini or the request timed out. Check server connectivity and try again.'}}
}
export async function POST(request:Request){
 let id:unknown;
 try{const body=await request.json();id=body?.siteId}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers})}
 if(typeof id!=='string'||id.length>100)return NextResponse.json({error:'Choose a valid catalog site.'},{status:400,headers});
 const site=heritageSites.find(item=>item.id===id);
 if(!site)return NextResponse.json({error:'Site not found.'},{status:404,headers});
 const key=process.env.GEMINI_API_KEY?.trim();
 if(!key)return NextResponse.json({error:'Gemini is not configured. Add GEMINI_API_KEY to .env.local on the server and restart it.'},{status:503,headers});
 // Use only the server catalog, not client-supplied prompts or coordinates. Sources are references,
 // not independently fetched or validated by this endpoint.
 const facts=[`Place: ${site.name}`,`Category: ${site.category}`,`Period: ${site.period}`,`Overview: ${site.description}`,`History: ${site.history}`,...site.facts.map(f=>`Catalog note: ${f}`)].join('\n');
 const textPrompt=`You are writing a respectful museum companion for the selected heritage site. Use ONLY the catalog statements below. Do not add names, dates, events, architecture, visitor rules, locations, or claims not explicitly present. Preserve uncertainty and traditional attribution. If information is sparse, say so rather than invent details. Do not pretend you checked sources or have live information. Write a short engaging introduction and a short note for a respectful visit. Plain text, under 150 words.\n\n${facts}`;
 const imagePrompt=`Create one cinematic, stylized 3D-rendered artistic illustration inspired by a Sri Lankan heritage visit. The selected catalog site is ${site.name} (${site.category}). The depiction is imaginary, not a historical reconstruction or photograph. No text, no labels, no maps, no route, no UI, no people reenacting sacred rituals. Be respectful; do not imply architectural or historical accuracy. Landscape orientation.`;
 const [story,image]=await Promise.all([generate(key,'gemini-2.5-flash',textPrompt,false),generate(key,'gemini-2.5-flash-image',imagePrompt,true)]);
 return NextResponse.json({story:story.value,image:image.value,storyError:story.error,imageError:image.error},{headers});
}

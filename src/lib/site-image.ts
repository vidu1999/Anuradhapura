/** OpenRouter image generation server-tool integration. Image data is never treated as historical evidence. */
export type ImageSite={id:string;name:string;category:string;description:string;modelUrl?:string};
export function validImageData(value:unknown):value is string {
 return typeof value==='string'&&value.length<=12_000_000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export function readGeneratedImage(data:unknown):string|null {
 if(!data||typeof data!=='object')return null;
 const output=(data as {output?:unknown}).output;if(!Array.isArray(output))return null;
 for(const item of output){if(!item||typeof item!=='object'||item.type!=='openrouter:image_generation'||item.status!=='completed')continue;for(const candidate of [item.result,item.imageUrl])if(validImageData(candidate))return candidate}
 return null;
}
export function imageError(status:number):string {
 if(status===401)return 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY on the server.';
 if(status===402)return 'OpenRouter reports insufficient credits or a spending limit for image generation.';
 if(status===403)return 'OpenRouter denied access to the configured model or image tool. Check account and privacy settings.';
 if(status===429)return 'Image generation rate limit or quota reached. Please try again later.';
 if(status===400||status===404)return 'OpenRouter could not use the configured image or text model. Check your model settings and access.';
 return 'Image generation failed at OpenRouter. Please try again later.';
}
export type ImageArgs={key:string;textModel:string;imageModel:string;site:ImageSite;signal:AbortSignal};
export async function generateSiteImage(args:ImageArgs,fetcher:typeof fetch=fetch):Promise<string|null>{
 const prompt=`Generate exactly one stylized 3D-style illustration inspired by the Sri Lankan heritage location ${args.site.name} (${args.site.category}). Context: ${args.site.description}. Respect sacred traditions. This is an imagined artistic interpretation, not a photograph or a historically verified reconstruction. Do not add text, labels, symbols of modern politics or routes.`;
 const response=await fetcher('https://openrouter.ai/api/v1/responses',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${args.key}`,'X-Title':'HeritageVerse'},
  body:JSON.stringify({model:args.textModel,input:prompt,tools:[{type:'openrouter:image_generation',parameters:{model:args.imageModel}}],tool_choice:'required',max_output_tokens:400}),
  cache:'no-store',redirect:'error',signal:args.signal
 });
 if(!response.ok)throw Object.assign(new Error('Image service request failed'),{status:response.status});
 return readGeneratedImage(await response.json());
}

/** Server-side adapter for OpenRouter's chat completions API. */
import type { GuideMessage } from './ai-guide';
type GenerateArgs={key:string;model:string;instruction:string;messages:GuideMessage[];signal:AbortSignal};
type OpenRouterResponse={choices?:Array<{message?:{content?:unknown}}>};
export function openRouterError(status:number):string {
 if(status===401)return 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY on the server.';
 if(status===402)return 'OpenRouter reports insufficient credits or a spending limit. Check your account and chosen model.';
 if(status===403)return 'OpenRouter denied access. Check your key permissions, model access and privacy settings.';
 if(status===404)return 'OpenRouter could not find this model or an available provider. Check OPENROUTER_GUIDE_MODEL.';
 if(status===429)return 'OpenRouter rate limit or quota reached. Please wait and try again.';
 if(status===400)return 'OpenRouter rejected the request. Check the configured model and account settings.';
 return 'OpenRouter could not complete the request. Please try again later.';
}
export async function generateOpenRouter(args:GenerateArgs,fetcher:typeof fetch=fetch):Promise<string|undefined>{
 const response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${args.key}`,'X-Title':'HeritageVerse'},
  body:JSON.stringify({model:args.model,messages:[{role:'system',content:args.instruction},...args.messages.map(message=>({role:message.role==='model'?'assistant':'user',content:message.text}))],temperature:0.3,max_tokens:700}),
  signal:args.signal,cache:'no-store',redirect:'error'
 });
 if(!response.ok)throw Object.assign(new Error('OpenRouter request failed'),{status:response.status});
 const data=await response.json() as OpenRouterResponse;
 const content=data?.choices?.[0]?.message?.content;
 if(typeof content==='string')return content;
 if(Array.isArray(content))return content.flatMap(part=>part&&typeof part==='object'&&part.type==='text'&&typeof part.text==='string'?[part.text]:[]).join('\n');
 return undefined;
}

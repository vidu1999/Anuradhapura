import { GoogleGenAI } from '@google/genai';
import { heritageSites } from '@/data/sites';
import { createRateLimiter, handleGuide } from '@/lib/ai-guide';
import { geminiError } from '@/lib/gemini';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Per-process limit is only a prototype safeguard, not a replacement for authenticated distributed rate limiting.
const allow=createRateLimiter();
export async function POST(request:Request){
 return handleGuide(request,{
  sites:heritageSites,key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_GUIDE_MODEL,allow,errorMessage:geminiError,
  generate:async({key,model,instruction,messages,signal})=>{
   const ai=new GoogleGenAI({apiKey:key});
   const response=await ai.models.generateContent({model,contents:messages.map(message=>({role:message.role,parts:[{text:message.text}]})),config:{systemInstruction:instruction,temperature:0.3,maxOutputTokens:700,abortSignal:signal}});
   return response.text;
  }
 });
}

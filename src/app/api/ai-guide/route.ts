import { heritageSites } from '@/data/sites';
import { createRateLimiter, handleGuide } from '@/lib/ai-guide';
import { generateOpenRouter, openRouterError } from '@/lib/openrouter';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Per-process limit is only a prototype safeguard, not a replacement for authenticated distributed rate limiting.
const allow=createRateLimiter();
export async function POST(request:Request){
 return handleGuide(request,{
  sites:heritageSites,key:process.env.OPENROUTER_API_KEY,model:process.env.OPENROUTER_GUIDE_MODEL,allow,errorMessage:openRouterError,generate:generateOpenRouter
 });
}

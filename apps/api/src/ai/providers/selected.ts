import { env } from '../../config/env.js';
import { generativeProvider } from './generative.js';
import { geminiProvider } from './gemini.js';
import { deepseekProvider } from './deepseek.js';
export function selectedGenerativeProvider(fetcher:typeof fetch=fetch){
  if(env.LLM_PROVIDER==='deepseek')return deepseekProvider(env.LLM_API_KEY,env.LLM_MODEL,fetcher);
  return env.LLM_PROVIDER==='gemini'?geminiProvider(env.LLM_API_KEY,env.LLM_MODEL,fetcher):generativeProvider(env.LLM_API_KEY,env.LLM_MODEL,fetcher);
}

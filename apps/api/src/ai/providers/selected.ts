import { env } from '../../config/env.js';
import { generativeProvider } from './generative.js';
import { geminiProvider } from './gemini.js';
export function selectedGenerativeProvider(){
  return env.LLM_PROVIDER==='gemini'?geminiProvider(env.LLM_API_KEY,env.LLM_MODEL):generativeProvider(env.LLM_API_KEY,env.LLM_MODEL);
}

import { eq } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import { modelRuns } from '../db/schema/index.js';
import { env } from '../config/env.js';
try {
  const [run]=await db.select().from(modelRuns).where(eq(modelRuns.id,'1e10dcdf-1b64-4d58-b554-86ecf16feb86'));
  console.log(JSON.stringify({flags:{planner:env.QA_PLANNER_ENABLED,jev:env.QA_JEV_ENABLED,extraction:env.ANALYSIS_EXTRACTION_ENABLED,answer:env.QA_LIVE_ENABLED},budget:env.MODEL_MAX_CALLS,timeout_ms:env.MODEL_TIMEOUT_MS,synthetic_planner:run?{id:run.id,input_hash:run.inputHash,output:run.output,model:run.model,prompt:run.promptVersion,schema:run.schemaVersion}:null},null,2));
} finally {await pool.end();}

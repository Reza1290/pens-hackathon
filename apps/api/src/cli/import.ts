import { db, pool } from '../db/client.js';
import { importDataset } from '../modules/ingestion/service.js';
import { readManifest } from '../modules/ingestion/manifest.js';
import { requiredArg } from './args.js';
try { const result=await importDataset(db,await readManifest(requiredArg('manifest'))); console.log(JSON.stringify(result,null,2)); if(result.status!=='ready') process.exitCode=1; }
finally { await pool.end(); }

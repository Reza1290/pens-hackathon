import { db,pool } from '../db/client.js';
import { analyzeDataset } from '../modules/opportunities/service.js';
import { requiredArg } from './args.js';
try { console.log(JSON.stringify(await analyzeDataset(db,requiredArg('dataset'),requiredArg('as-of')),null,2)); }
finally { await pool.end(); }

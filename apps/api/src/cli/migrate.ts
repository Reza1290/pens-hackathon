import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pool } from '../db/client.js';
import { projectRoot } from '../config/env.js';
try { await migrate(drizzle(pool), { migrationsFolder: resolve(projectRoot, 'apps/api/src/db/migrations') }); console.log('Committed migrations applied.'); }
finally { await pool.end(); }

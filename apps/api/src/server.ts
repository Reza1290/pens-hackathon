import { createApp } from './app.js';
import { db,pool } from './db/client.js';
import { env } from './config/env.js';
const host = env.API_HOST || '0.0.0.0';
const server = createApp(db).listen(env.API_PORT, host, () => console.log(`API ready at http://${host}:${env.API_PORT}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{server.close(()=>{void pool.end();});});

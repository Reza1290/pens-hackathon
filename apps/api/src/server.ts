import { createApp } from './app.js';
import { db,pool } from './db/client.js';
import { env } from './config/env.js';
const server=createApp(db).listen(env.API_PORT,'127.0.0.1',()=>console.log(`Local API ready at http://127.0.0.1:${env.API_PORT}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{server.close(()=>{void pool.end();});});

import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({mode})=>{const config=loadEnv(mode,resolve(import.meta.dirname,'../..'),'API_PORT');return {plugins:[react()],server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${config.API_PORT||process.env.API_PORT||3001}`}}},preview:{host:'127.0.0.1'}};});

import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env.js';
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema/index.ts', out: './src/db/migrations', dbCredentials: { url: env.DATABASE_URL }, casing: 'snake_case' });

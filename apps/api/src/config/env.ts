import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

let root = resolve(process.cwd());
while (!existsSync(resolve(root, 'package.json')) || !JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).workspaces) {
  const parent = dirname(root);
  if (parent === root) throw new Error('Run from within the KasirNusa repository');
  root = parent;
}
export const projectRoot = root;
dotenv.config({ path: resolve(root, '.env'), quiet: true });
export const env = z.object({
  DATABASE_URL: z.string().url().default('postgresql://kasirnusa:local_dev_only@127.0.0.1:54329/kasirnusa'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATA_ROOT: z.string().default('data/raw'),
  ALLOWED_DATASET_IDS: z.string().default(''),
}).parse(process.env);
export const allowedDatasets = new Set(env.ALLOWED_DATASET_IDS.split(',').filter(Boolean));

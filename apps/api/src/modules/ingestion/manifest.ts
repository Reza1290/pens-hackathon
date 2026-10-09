import { createHash } from 'node:crypto';
import { readFile, realpath, mkdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { z } from 'zod';
import { env, projectRoot } from '../../config/env.js';

export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const manifestSchema = z.object({ schema_version: z.literal('source-manifest-v1'), dataset_version: z.string().regex(/^[a-zA-Z0-9_-]+$/), mapping_version: z.literal('phase0-v1'), as_of: z.iso.date(), content_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  files: z.array(z.object({ filename: z.string().refine(v => basename(v) === v && !v.includes('..')), relative_path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().nonnegative(), kind: z.enum(['documentation','records']), records: z.number().int().nonnegative().optional(), columns: z.array(z.string()).optional() })),
});
export type Manifest = z.infer<typeof manifestSchema>;
export function inside(root: string, target: string) {
  const path = relative(root, target);
  if (path.startsWith('..') || isAbsolute(path)) throw new Error('Path leaves configured data root');
  return target;
}
export async function readManifest(path: string) {
  const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(projectRoot, path), 'utf8')));
  // Preserve the canonical file order emitted by source-manifest-v1's auditor.
  const files = manifest.files;
  if (new Set(files.map(f => f.filename)).size !== files.length) throw new Error('Duplicate manifest filenames');
  if (sha256(JSON.stringify(files.map(f => [f.filename, f.sha256]))) !== manifest.content_manifest_sha256) throw new Error('Manifest hash mismatch');
  return manifest;
}
export async function verifiedFiles(manifest: Manifest, prepared = true) {
  const root = await realpath(resolve(projectRoot, env.DATA_ROOT));
  const results = [];
  for (const file of manifest.files) {
    const path = await realpath(inside(root, prepared ? resolve(root, manifest.dataset_version, file.filename) : resolve(projectRoot, file.relative_path)));
    inside(root, path);
    const bytes = await readFile(path);
    if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error(`Checksum/size mismatch: ${file.filename}`);
    // Reject malformed UTF-8 rather than silently replace bytes.
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    results.push({ file, path, bytes, content });
  }
  return results;
}
export async function prepare(manifest: Manifest) {
  const originals = await verifiedFiles(manifest, false);
  const root = await realpath(resolve(projectRoot, env.DATA_ROOT));
  const destination = inside(root, resolve(root, manifest.dataset_version));
  await mkdir(destination, { recursive: true });
  inside(root, await realpath(destination));
  for (const { file, path } of originals) {
    const target = resolve(destination, file.filename);
    try { await copyFile(path, target, constants.COPYFILE_EXCL); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  await verifiedFiles(manifest);
  return destination;
}

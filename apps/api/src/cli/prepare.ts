import { prepare, readManifest } from '../modules/ingestion/manifest.js';
import { requiredArg } from './args.js';
const destination = await prepare(await readManifest(requiredArg('manifest')));
console.log(`Original checksums verified; immutable copy prepared at ${destination}`);

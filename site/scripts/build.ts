import { join } from 'node:path';

import { buildSite } from '../src/build';

const outDir = join(import.meta.dir, '..', 'dist');
const files = await buildSite(outDir);
console.log(`Built ${files.length} files into ${outDir}`);
for (const f of files) console.log(`  ${f}`);

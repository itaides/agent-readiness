// Emits the library's .d.ts files into dist/types, then adds the .js extensions Node's ESM resolution
// needs: the source imports without extensions (bundler style), and tsc copies specifiers as written.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const OUT = join(import.meta.dir, '..', 'dist', 'types');

const tsc = Bun.spawnSync(['bunx', 'tsc', '-p', 'tsconfig.types.json'], { cwd: join(import.meta.dir, '..'), stdio: ['inherit', 'inherit', 'inherit'] });
if (tsc.exitCode !== 0) process.exit(tsc.exitCode ?? 1);

function* declarations(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* declarations(path);
    else if (name.endsWith('.d.ts')) yield path;
  }
}

for (const file of declarations(OUT)) {
  const source = readFileSync(file, 'utf8');
  const fixed = source.replace(/((?:from |import\()['"])(\.{1,2}\/[^'"]+)(['"])/g, (match, open: string, spec: string, close: string) => {
    const base = resolve(dirname(file), spec);
    if (existsSync(`${base}.d.ts`)) return `${open}${spec}.js${close}`;
    if (existsSync(join(base, 'index.d.ts'))) return `${open}${spec}/index.js${close}`;
    throw new Error(`${file}: cannot resolve ${spec}`);
  });
  if (fixed !== source) writeFileSync(file, fixed);
}

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_AGE_DAYS = 365;
const checksDir = new URL('../src/checks/', import.meta.url);
const now = new Date();
const failures: string[] = [];

for (const file of (await readdir(checksDir)).filter((name) => name.endsWith('.ts') && !name.startsWith('_')).sort()) {
  const source = await readFile(new URL(file, checksDir), 'utf8');
  const id = source.match(/id:\s*'([^']+)'/)?.[1] ?? file.replace(/\.ts$/, '');
  const asOf = source.match(/asOf:\s*'([^']+)'/)?.[1];
  const specUrl = source.match(/url:\s*'([^']+)'/)?.[1];
  if (!asOf || !specUrl) {
    failures.push(`${id}: missing static spec.url or spec.asOf`);
    continue;
  }
  const reviewed = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(reviewed.getTime())) {
    failures.push(`${id}: invalid spec.asOf ${asOf}`);
    continue;
  }
  const ageDays = Math.floor((now.getTime() - reviewed.getTime()) / 86_400_000);
  if (ageDays > MAX_AGE_DAYS) failures.push(`${id}: spec review is ${ageDays} days old (${asOf})`);
}

if (failures.length) {
  console.error(`Spec staleness audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

console.log(`Spec staleness audit passed for ${join('src', 'checks')} (max age ${MAX_AGE_DAYS} days).`);

import { createHash } from 'node:crypto';
import type { Check, CheckResult, Evidence } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const NAME_RE = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

const META = {
  id: 'agent-skills',
  category: 'capabilities' as const,
  title: 'Agent Skills discovery v0.2',
  spec: { url: 'https://github.com/cloudflare/agent-skills-discovery-rfc', asOf: '2026-08-04' },
};

interface SkillEntry {
  name: string;
  type: 'skill-md' | 'archive';
  description: string;
  url: string;
  digest: string;
}

function validateEntry(value: unknown, index: number): string | SkillEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `skills[${index}] must be an object`;
  const entry = value as Record<string, unknown>;
  if (typeof entry.name !== 'string' || !NAME_RE.test(entry.name)) return `skills[${index}].name is not a valid Agent Skills name`;
  if (entry.type !== 'skill-md' && entry.type !== 'archive') return `skills[${index}].type must be "skill-md" or "archive"`;
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0 || entry.description.length > 1024) return `skills[${index}].description must contain 1-1024 characters`;
  if (typeof entry.url !== 'string' || entry.url.length === 0) return `skills[${index}].url is required`;
  if (typeof entry.digest !== 'string' || !DIGEST_RE.test(entry.digest)) return `skills[${index}].digest must be sha256 plus 64 lowercase hex characters`;
  return entry as unknown as SkillEntry;
}

async function verifyArtifacts(entries: SkillEntry[], indexUrl: string, http: Parameters<Check['run']>[1], evidence: Evidence): Promise<string | null> {
  for (const entry of entries) {
    let url: URL;
    try { url = new URL(entry.url, indexUrl); }
    catch { return `Skill "${entry.name}" has an invalid artifact URL`; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return `Skill "${entry.name}" artifact URL must use HTTP(S)`;
    const response = await http.fetch(url.toString());
    if (response.status !== 200) return `Skill "${entry.name}" artifact returned HTTP ${response.status}`;
    const actual = `sha256:${createHash('sha256').update(response.body).digest('hex')}`;
    if (actual !== entry.digest) return `Skill "${entry.name}" digest mismatch (expected ${entry.digest}, got ${actual})`;
  }
  evidence.note = `Validated v0.2 index and verified ${entries.length} artifact digest(s)`;
  return null;
}

const agentSkills: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http, options): Promise<CheckResult> {
    const result = await fetchJsonWellKnown(target.origin, '/.well-known/agent-skills/index.json', http);
    if (!result.ok) return makeResult(META, 'fail', result.reason, result.evidence);
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      return makeResult(META, 'fail', 'Discovery index must be a JSON object', result.evidence);
    }
    const data = result.data as Record<string, unknown>;
    if (data.$schema !== SCHEMA) return makeResult(META, 'fail', `Expected $schema "${SCHEMA}"`, result.evidence);
    if (!Array.isArray(data.skills) || data.skills.length === 0) return makeResult(META, 'fail', '"skills" must be a non-empty array', result.evidence);

    const entries: SkillEntry[] = [];
    const indexUrl = new URL('/.well-known/agent-skills/index.json', target.origin).toString();
    for (let index = 0; index < data.skills.length; index++) {
      const validated = validateEntry(data.skills[index], index);
      if (typeof validated === 'string') return makeResult(META, 'fail', validated, result.evidence);
      try {
        const artifactUrl = new URL(validated.url, indexUrl);
        if (artifactUrl.protocol !== 'http:' && artifactUrl.protocol !== 'https:') throw new Error('unsupported protocol');
      } catch {
        return makeResult(META, 'fail', `skills[${index}].url must resolve to an HTTP(S) URL`, result.evidence);
      }
      entries.push(validated);
    }
    if (new Set(entries.map((entry) => entry.name)).size !== entries.length) {
      return makeResult(META, 'fail', 'Skill names must be unique', result.evidence);
    }

    if (options?.verifySkillDigests) {
      const error = await verifyArtifacts(entries, indexUrl, http, result.evidence);
      if (error) return makeResult(META, 'fail', error, result.evidence);
    } else {
      result.evidence.note = 'Validated v0.2 index metadata; artifact digests not fetched (use --verify-skill-digests)';
    }
    return makeResult(META, 'pass', `${entries.length} valid v0.2 skill(s)`, result.evidence);
  },
};

export default agentSkills;

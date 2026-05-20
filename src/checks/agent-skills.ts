import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'agent-skills',
  category: 'capabilities' as const,
  title: 'Agent Skills index',
  spec: { url: 'https://blog.cloudflare.com/agent-readiness/', asOf: '2026-04-17' },
};

const agentSkills: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/agent-skills/index.json', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as Record<string, unknown>;
    const skills: unknown[] | null = Array.isArray(data)
      ? data
      : Array.isArray((data as { skills?: unknown[] }).skills)
        ? (data as { skills: unknown[] }).skills
        : null;
    if (!skills) return makeResult(META, 'fail', 'JSON parses but no skills array (expected top-level array or { skills: [...] })', r.evidence);
    if (skills.length === 0) return makeResult(META, 'fail', 'Skills array is empty', r.evidence);

    const first = skills[0] as { name?: string; title?: string };
    const firstName = first?.name ?? first?.title ?? '(unnamed)';
    return makeResult(META, 'pass', `${skills.length} skill(s), first: "${firstName}"`, r.evidence);
  },
};

export default agentSkills;

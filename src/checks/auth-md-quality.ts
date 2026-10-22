import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchText, getEvidence, makeResult, memoize } from './_shared';

const SPEC = { url: 'https://workos.com/auth-md/docs/auth-md', asOf: '2026-10-22' };

const SECTIONS = ['discover', 'register', 'claim', 'exchange', 'use', 'error', 'revok'];

interface AuthMdDoc { body: string; url: string; evidence: ReturnType<typeof getEvidence> }

function getAuthMd(target: Target, http: HttpClient): Promise<AuthMdDoc | null> {
  return memoize(`authmd:${target.origin}`, async () => {
    const url = new URL('/auth.md', target.origin).toString();
    const res = await fetchText(url, http);
    if (res.status !== 200 || !/text|markdown/i.test(res.contentType)) return null;
    return { body: res.text, url, evidence: getEvidence('GET', url, res) };
  });
}

export const authMdStructure: Check = {
  id: 'auth-md-structure',
  category: 'capabilities',
  title: 'auth.md walkthrough structure',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'auth-md-structure', category: 'capabilities' as const, title: 'auth.md walkthrough structure', spec: SPEC };
    const doc = await getAuthMd(target, http);
    if (!doc) return makeResult(meta, 'skip', 'No auth.md to grade', {});
    const lower = doc.body.toLowerCase();
    const found = SECTIONS.filter((s) => lower.includes(s));
    if (found.length >= 5) return makeResult(meta, 'pass', `Walkthrough sections present: ${found.join(', ')}`, doc.evidence);
    if (found.length >= 3) return makeResult(meta, 'warn', `Partial walkthrough (${found.join(', ')}); missing ${SECTIONS.filter((s) => !found.includes(s)).join(', ')}`, doc.evidence);
    return makeResult(meta, 'warn', `auth.md lacks the standard walkthrough structure (found only: ${found.join(', ') || 'none'})`, doc.evidence);
  },
};

export const authMdEndpoints: Check = {
  id: 'auth-md-endpoints',
  category: 'capabilities',
  title: 'auth.md referenced endpoints reachable',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'auth-md-endpoints', category: 'capabilities' as const, title: 'auth.md referenced endpoints reachable', spec: SPEC };
    const doc = await getAuthMd(target, http);
    if (!doc) return makeResult(meta, 'skip', 'No auth.md to check', {});
    const urls = [...new Set([...doc.body.matchAll(/https?:\/\/[^\s)"'`>\]]+/g)].map((m) => m[0]))].slice(0, 4);
    const internal = [...new Set([...doc.body.matchAll(/\]\(\/([^)\s]+)|GET\s+(\/[^\s]+)|POST\s+(\/[^\s]+)/g)].map((m) => m[1] ?? m[2] ?? m[3]).filter(Boolean))].slice(0, 4);
    const probes = [...urls, ...internal.map((p) => new URL('/' + p.replace(/^\//, ''), target.origin).toString())].slice(0, 4);
    if (probes.length === 0) return makeResult(meta, 'warn', 'auth.md references no endpoints to verify', doc.evidence);
    const dead: string[] = [];
    for (const u of probes) {
      try {
        const res = await fetchText(u, http);
        if (res.status === 404 || res.status >= 500) dead.push(`${u} (HTTP ${res.status})`);
      } catch {
        dead.push(`${u} (unreachable)`);
      }
    }
    doc.evidence.note = `probed: ${probes.join(', ')}`;
    if (dead.length) return makeResult(meta, 'warn', `Endpoints referenced in auth.md not reachable: ${dead.join(', ')}`, doc.evidence);
    return makeResult(meta, 'pass', `All ${probes.length} referenced endpoints respond`, doc.evidence);
  },
};

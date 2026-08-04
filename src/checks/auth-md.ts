import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'auth-md',
  category: 'capabilities' as const,
  title: 'auth.md agent registration guide',
  spec: { url: 'https://workos.com/auth-md/docs/auth-md', asOf: '2026-08-04' },
};

const authMd: Check = {
  ...META,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/auth.md', target.origin).toString();
    const response = await http.fetch(url, { headers: { Accept: 'text/markdown, text/plain;q=0.9' } });
    const body = decodeBody(response.body);
    const evidence: Evidence = {
      request: { method: 'GET', url, headers: { Accept: 'text/markdown, text/plain;q=0.9' } },
      response: { status: response.status, contentType: response.contentType, bytes: response.body.length, preview: body.slice(0, 256) },
      note: 'auth.md is a prose companion; OAuth Protected Resource Metadata remains authoritative.',
    };
    if (response.status !== 200) return makeResult(META, 'warn', `Not found (HTTP ${response.status})`, evidence);
    if (response.contentType && !/^text\/(markdown|plain)/i.test(response.contentType)) return makeResult(META, 'warn', `Unexpected content-type "${response.contentType}"`, evidence);
    if (!/^#\s+auth\.md\s*$/im.test(body)) return makeResult(META, 'warn', 'Document should contain an H1 named auth.md', evidence);
    if (!/\.well-known\/oauth-protected-resource/i.test(body)) return makeResult(META, 'warn', 'Document does not point agents to OAuth Protected Resource Metadata', evidence);
    return makeResult(META, 'pass', 'auth.md found and points to authoritative OAuth metadata', evidence);
  },
};

export default authMd;

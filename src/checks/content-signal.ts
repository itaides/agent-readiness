import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'content-signal',
  category: 'bot-access' as const,
  title: 'Content-Signal directive in robots.txt',
  spec: { url: 'https://blog.cloudflare.com/agent-readiness/', asOf: '2026-04-17' },
};

const RECOGNIZED = ['ai-train', 'ai-input', 'search'];

const contentSignal: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/robots.txt', target.origin).toString();
    const res = await http.fetch(url);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length },
    };

    if (res.status !== 200) return makeResult(META, 'fail', `robots.txt unavailable (HTTP ${res.status})`, evidence);

    const lines = bodyText.split(/\r?\n/).filter((l) => /^\s*content-signal\s*:/i.test(l));
    if (lines.length === 0) return makeResult(META, 'fail', 'No Content-Signal: directive in robots.txt', evidence);

    const matched: string[] = [];
    for (const line of lines) {
      for (const sig of RECOGNIZED) {
        if (new RegExp(`\\b${sig}\\s*=`, 'i').test(line) && !matched.includes(sig)) matched.push(sig);
      }
    }
    if (matched.length === 0) {
      return makeResult(META, 'fail', `Content-Signal: present but no recognized signals (expected one of ${RECOGNIZED.join(', ')})`, evidence);
    }
    evidence.note = `Matched directives: ${lines.map((l) => l.trim()).join(' | ')}`;
    return makeResult(META, 'pass', `Recognized signals: ${matched.join(', ')}`, evidence);
  },
};

export default contentSignal;

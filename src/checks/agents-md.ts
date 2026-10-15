import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'agents-md',
  category: 'content' as const,
  title: 'AGENTS.md instruction file',
  spec: { url: 'https://agents.md/', asOf: '2026-10-13' },
};

const CANDIDATES = ['/AGENTS.md', '/agents.md', '/.well-known/agents.md', '/CLAUDE.md', '/claude.md'];
const SECTIONS: Array<{ name: string; re: RegExp }> = [
  { name: 'install', re: /\b(install|setup|getting started|quick ?start|prerequisites?)\b/i },
  { name: 'config', re: /\b(configur|environment variables?|\.env|settings?)\b/i },
  { name: 'usage', re: /\b(usage|examples?|how to use|commands?)\b/i },
];

const agentsMd: Check = {
  ...META,
  defaultEnabled: false,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    for (const path of CANDIDATES) {
      const url = new URL(path, target.origin).toString();
      const res = await http.fetch(url);
      if (res.status !== 200) continue;
      const bodyText = decodeBody(res.body);
      const evidence: Evidence = {
        request: { method: 'GET', url },
        response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: bodyText.slice(0, 256) },
      };
      if (res.contentType && !/markdown|text\/(plain|html)/i.test(res.contentType)) continue;
      if (/^\s*<!doctype|^\s*<html/i.test(bodyText.slice(0, 512))) continue;
      if (bodyText.trim().length === 0) continue;
      const found = SECTIONS.filter((s) => s.re.test(bodyText)).map((s) => s.name);
      if (found.length >= 2) {
        return makeResult(META, 'pass', `${path} with sections: ${found.join(', ')}`, evidence);
      }
      return makeResult(META, 'warn', `${path} found but thin — only ${found.length}/3 of install/config/usage content`, evidence);
    }
    const evidence: Evidence = { request: { method: 'GET', url: new URL('/AGENTS.md', target.origin).toString() } };
    return makeResult(META, 'fail', 'No AGENTS.md instruction file found', evidence);
  },
};

export default agentsMd;

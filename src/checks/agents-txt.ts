import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'agents-txt',
  category: 'capabilities' as const,
  title: 'agents.txt / agents.json capability declaration',
  spec: { url: 'https://agents-txt.com/', asOf: '2026-10-13' },
};

const agentsTxt: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const jsonUrl = new URL('/agents.json', target.origin).toString();
    const jsonRes = await http.fetch(jsonUrl);
    const jsonEvidence: Evidence = {
      request: { method: 'GET', url: jsonUrl },
      response: { status: jsonRes.status, contentType: jsonRes.contentType, bytes: jsonRes.body.length },
    };
    if (jsonRes.status === 200 && /json/i.test(jsonRes.contentType)) {
      try {
        const data = JSON.parse(decodeBody(jsonRes.body)) as Record<string, unknown>;
        const keys = Object.keys(data).length;
        return makeResult(META, 'pass', `/agents.json capability declaration (${keys} top-level keys)`, jsonEvidence);
      } catch { /* fall through to agents.txt */ }
    }

    const txtUrl = new URL('/agents.txt', target.origin).toString();
    const res = await http.fetch(txtUrl);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url: txtUrl },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: bodyText.slice(0, 256) },
    };
    if (res.status === 200 && bodyText.trim().length > 0 && /text\/(plain|markdown)/i.test(res.contentType)) {
      const blocks = bodyText.match(/^#+\s*(mcp|a2a|payment|x402|ucp|skills?|api|auth)/gim)?.length ?? 0;
      return makeResult(META, 'pass', `/agents.txt found${blocks ? ` (${blocks} capability block(s))` : ''}`, evidence);
    }
    return makeResult(META, 'warn', 'No agents.txt or agents.json capability declaration (emerging standard)', evidence);
  },
};

export default agentsTxt;

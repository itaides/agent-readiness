import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'markdown-negotiation',
  category: 'content' as const,
  title: 'Markdown content negotiation',
  spec: { url: 'https://blog.cloudflare.com/agent-readiness/', asOf: '2026-04-17' },
};

const markdownNegotiation: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = target.contentUrl.toString();
    const res = await http.fetch(url, { headers: { Accept: 'text/markdown' } });
    const head = decodeBody(res.body.subarray(0, 256));
    const evidence: Evidence = {
      request: { method: 'GET', url, headers: { Accept: 'text/markdown' } },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: head },
    };

    if (res.status !== 200) return makeResult(META, 'fail', `HTTP ${res.status}`, evidence);
    if (!/^text\/markdown/i.test(res.contentType)) {
      return makeResult(META, 'fail', `content-type "${res.contentType}" is not text/markdown`, evidence);
    }
    if (res.body.length === 0) return makeResult(META, 'fail', 'Returned text/markdown but body is empty', evidence);
    if (/^\s*<!doctype|^\s*<html/i.test(head)) {
      return makeResult(META, 'fail', 'Body looks like HTML — server ignored Accept and mislabeled content-type', evidence);
    }
    return makeResult(META, 'pass', 'Server returns text/markdown for Accept: text/markdown', evidence);
  },
};

export default markdownNegotiation;

import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'llms-full-txt',
  category: 'content' as const,
  title: 'llms-full.txt',
  spec: { url: 'https://llmstxt.org/', asOf: '2026-10-13' },
};

const llmsFullTxt: Check = {
  ...META,
  defaultEnabled: false,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/llms-full.txt', target.origin).toString();
    const res = await http.fetch(url);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: bodyText.slice(0, 256) },
    };

    if (res.status !== 200) return makeResult(META, 'fail', `Not found (HTTP ${res.status})`, evidence);
    if (res.contentType && !/^text\/(plain|markdown)/i.test(res.contentType)) {
      return makeResult(META, 'fail', `content-type "${res.contentType}" is not text/plain or text/markdown`, evidence);
    }
    if (bodyText.length === 0) return makeResult(META, 'fail', 'Empty body', evidence);
    return makeResult(META, 'pass', `llms-full.txt found (${(res.body.length / 1024).toFixed(1)} KB)`, evidence);
  },
};

export default llmsFullTxt;

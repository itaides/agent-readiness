import type { Category, Check, CheckResult, Evidence } from '../types';

const SPEC = {
  url: 'https://datatracker.ietf.org/doc/html/rfc9309',
  asOf: '2026-04-17',
};

const robotsTxt: Check = {
  id: 'robots-txt',
  category: 'discoverability',
  title: 'robots.txt',
  spec: SPEC,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/robots.txt', target.origin).toString();
    const res = await http.fetch(url);
    const bodyText = new TextDecoder('utf-8').decode(res.body);

    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: {
        status: res.status,
        contentType: res.contentType,
        bytes: res.body.length,
        finalUrl: res.finalUrl,
        redirectChain: res.redirectChain.length ? res.redirectChain : undefined,
        preview: bodyText.slice(0, 256),
      },
    };

    const base = {
      id: 'robots-txt',
      category: 'discoverability' as Category,
      title: 'robots.txt',
      spec: SPEC,
      evidence,
    };
    const fail = (message: string): CheckResult => ({
      ...base,
      status: 'fail',
      message,
      remediationPromptPath: 'prompts/robots-txt.md',
    });

    if (res.status !== 200) {
      return fail(`Not found (HTTP ${res.status})`);
    }

    if (res.contentType && !/^text\/plain/i.test(res.contentType)) {
      return fail(`Returned 200 but content-type "${res.contentType}" — not text/plain, likely HTML fallthrough`);
    }

    const groupMatches = bodyText.match(/^\s*user-agent\s*:/gim);
    if (!groupMatches || groupMatches.length === 0) {
      return fail('Returned 200 but body contains no "User-agent:" directive');
    }

    return {
      ...base,
      status: 'pass',
      message: `Valid robots.txt with ${groupMatches.length} User-agent group(s)`,
    };
  },
};

export default robotsTxt;

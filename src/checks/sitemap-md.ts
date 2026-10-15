import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'sitemap-md',
  category: 'content' as const,
  title: 'sitemap.md markdown index',
  spec: { url: 'https://vercel.com/kb/guide/agent-readability-spec', asOf: '2026-10-13' },
};

const sitemapMd: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/sitemap.md', target.origin).toString();
    const res = await http.fetch(url);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: bodyText.slice(0, 256) },
    };

    if (res.status !== 200) return makeResult(META, 'warn', `Not found (HTTP ${res.status}) — optional markdown site index`, evidence);
    if (res.contentType && !/markdown|text\/plain/i.test(res.contentType)) {
      return makeResult(META, 'warn', `200 but content-type "${res.contentType}" is not markdown`, evidence);
    }
    const links = bodyText.match(/\[[^\]]+\]\([^)]+\)/g)?.length ?? 0;
    if (links === 0) return makeResult(META, 'warn', 'sitemap.md exists but contains no markdown links', evidence);
    return makeResult(META, 'pass', `sitemap.md with ${links} links`, evidence);
  },
};

export default sitemapMd;

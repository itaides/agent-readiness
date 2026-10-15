import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'sitemap-lastmod',
  category: 'discoverability' as const,
  title: 'Sitemap lastmod coverage',
  spec: { url: 'https://www.sitemaps.org/protocol.html', asOf: '2026-10-13' },
};

const sitemapLastmod: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    let url = new URL('/sitemap.xml', target.origin).toString();
    let res = await http.fetch(url);
    if (res.status !== 200) {
      try {
        const robotsRes = await http.fetch(new URL('/robots.txt', target.origin).toString());
        if (robotsRes.status === 200) {
          const match = decodeBody(robotsRes.body).match(/^\s*sitemap\s*:\s*(\S+)/im);
          if (match) {
            url = match[1];
            res = await http.fetch(url);
          }
        }
      } catch { /* best-effort */ }
    }

    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length },
    };
    if (res.status !== 200) return makeResult(META, 'warn', 'No sitemap to inspect for lastmod coverage', evidence);
    const body = decodeBody(res.body);
    const urls = body.match(/<url[\s>]/g)?.length ?? 0;
    if (urls === 0) return makeResult(META, 'warn', 'Sitemap is an index or has no <url> entries', evidence);
    const lastmods = body.match(/<lastmod[\s>]/g)?.length ?? 0;
    // Round down for display, so a near miss (e.g. 79.5%) never reads as the 80% threshold.
    const pct = Math.floor((lastmods * 100) / urls);
    if (lastmods / urls >= 0.8) return makeResult(META, 'pass', `${lastmods}/${urls} URLs carry lastmod (${pct}%)`, evidence);
    return makeResult(META, 'warn', `Only ${lastmods}/${urls} URLs carry lastmod (${pct}%) — agents lose the freshness signal`, evidence);
  },
};

export default sitemapLastmod;

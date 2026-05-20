import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'sitemap',
  category: 'discoverability' as const,
  title: 'sitemap.xml',
  spec: { url: 'https://www.sitemaps.org/protocol.html', asOf: '2026-04-17' },
};

const sitemap: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    let url = new URL('/sitemap.xml', target.origin).toString();
    let source: 'well-known' | 'robots-discovered' = 'well-known';
    let res = await http.fetch(url);

    if (res.status !== 200) {
      const robotsUrl = new URL('/robots.txt', target.origin).toString();
      try {
        const robotsRes = await http.fetch(robotsUrl);
        if (robotsRes.status === 200) {
          const robotsBody = decodeBody(robotsRes.body);
          const match = robotsBody.match(/^\s*sitemap\s*:\s*(\S+)/im);
          if (match) {
            url = match[1];
            source = 'robots-discovered';
            res = await http.fetch(url);
          }
        }
      } catch { /* discovery is best-effort */ }
    }

    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, finalUrl: res.finalUrl },
      note: source === 'robots-discovered' ? 'Discovered via robots.txt Sitemap: directive' : undefined,
    };

    if (res.status !== 200) return makeResult(META, 'fail', `Not found (HTTP ${res.status})`, evidence);
    if (res.contentType && !/xml/i.test(res.contentType)) {
      return makeResult(META, 'fail', `200 but content-type "${res.contentType}" is not XML`, evidence);
    }
    const head = decodeBody(res.body.subarray(0, 256)).trimStart();
    if (!/^<\?xml|^<urlset|^<sitemapindex/i.test(head)) {
      return makeResult(META, 'fail', 'Body does not start with <?xml, <urlset, or <sitemapindex', evidence);
    }
    return makeResult(META, 'pass', `Valid sitemap (${source})`, evidence);
  },
};

export default sitemap;

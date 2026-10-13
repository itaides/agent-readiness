import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';
import { fetchContentPage, htmlLinkHrefs, parseLinkHeader } from './_page';

const META = {
  id: 'rss-atom',
  category: 'discoverability' as const,
  title: 'RSS/Atom feed',
  spec: { url: 'https://www.rssboard.org/rss-specification', asOf: '2026-10-13' },
};

const rssAtom: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    if (page.status !== 200) return makeResult(META, 'warn', `HTTP ${page.status} — could not inspect feed links`, evidence);

    const hrefs: string[] = [];
    for (const link of parseLinkHeader(page.headers.get('link'))) {
      if (link.params.rel === 'alternate' && /rss|atom/i.test(link.params.type ?? '')) hrefs.push(link.url);
    }
    hrefs.push(...htmlLinkHrefs(page.bodyText, 'alternate', 'rss+xml'));
    hrefs.push(...htmlLinkHrefs(page.bodyText, 'alternate', 'atom+xml'));
    hrefs.push(...htmlLinkHrefs(page.bodyText, 'alternate', 'application/rss'));
    hrefs.push(...htmlLinkHrefs(page.bodyText, 'alternate', 'application/atom'));

    for (const href of hrefs.slice(0, 3)) {
      const feedUrl = new URL(href, page.finalUrl).toString();
      const res = await http.fetch(feedUrl);
      if (res.status !== 200) continue;
      const head = decodeBody(res.body.subarray(0, 512));
      if (/^<\?xml|^<rss|^<feed/i.test(head.trimStart())) {
        const feedEvidence: Evidence = {
          request: { method: 'GET', url: feedUrl },
          response: { status: res.status, contentType: res.contentType, bytes: res.body.length },
        };
        return makeResult(META, 'pass', `Valid feed at ${new URL(feedUrl).pathname}`, feedEvidence);
      }
    }
    return makeResult(META, 'warn', 'No RSS/Atom feed advertised — optional machine-readable freshness channel', evidence);
  },
};

export default rssAtom;

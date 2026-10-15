import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { loadSitemap } from './_sitemap';

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
    const sitemap = await loadSitemap(target, http);
    const { evidence, entries } = sitemap;
    if (sitemap.status !== 200) return makeResult(META, 'warn', 'No sitemap to inspect for lastmod coverage', evidence);
    if (entries.length === 0) {
      const why = sitemap.isIndex ? 'Sitemap index lists no readable same-origin sitemaps with <url> entries' : 'Sitemap has no <url> entries';
      return makeResult(META, 'warn', why, evidence);
    }
    const urls = entries.length;
    const lastmods = entries.filter((e) => e.hasLastmod).length;
    const from = sitemap.isIndex ? ` across ${sitemap.children.length} sitemap(s) from the index` : '';
    // Round down for display, so a near miss (e.g. 79.5%) never reads as the 80% threshold.
    const pct = Math.floor((lastmods * 100) / urls);
    if (lastmods / urls >= 0.8) return makeResult(META, 'pass', `${lastmods}/${urls} URLs carry lastmod (${pct}%)${from}`, evidence);
    return makeResult(META, 'warn', `Only ${lastmods}/${urls} URLs carry lastmod (${pct}%)${from} — agents lose the freshness signal`, evidence);
  },
};

export default sitemapLastmod;

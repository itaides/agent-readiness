import type { Check, CheckResult, Evidence } from '../types';
import { fetchRobots, fetchText, getEvidence, makeResult } from './_shared';

const META = {
  id: 'sitemap-lastmod',
  category: 'content' as const,
  title: 'Sitemap freshness (lastmod)',
  spec: { url: 'https://www.sitemaps.org/protocol.html', asOf: '2026-10-22' },
};

async function sitemapBody(origin: URL, http: Parameters<Check['run']>[1]): Promise<{ body: string; evidence: Evidence } | null> {
  const direct = new URL('/sitemap.xml', origin).toString();
  const res = await fetchText(direct, http);
  if (res.status === 200 && /xml|text/i.test(res.contentType) && /<(urlset|sitemapindex)|<\?xml/i.test(res.text.slice(0, 512))) {
    return { body: res.text, evidence: getEvidence('GET', direct, res) };
  }
  const robots = await fetchRobots(origin, http);
  if (robots.status === 200) {
    const line = robots.body.split(/\r?\n/).find((l) => /^\s*sitemap\s*:/i.test(l));
    const loc = line?.split(':').slice(1).join(':').trim();
    if (loc) {
      const r2 = await fetchText(loc, http);
      if (r2.status === 200 && /<sitemap|<urlset|<\?xml/i.test(r2.text.slice(0, 512))) {
        return { body: r2.text, evidence: getEvidence('GET', loc, r2) };
      }
    }
  }
  return null;
}

const sitemapLastmod: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const sm = await sitemapBody(target.origin, http);
    if (!sm) return makeResult(META, 'skip', 'No sitemap found to grade', {});
    const mods = [...sm.body.matchAll(/<lastmod>\s*([^<]+)\s*<\/lastmod>/gi)].map((m) => m[1].trim());
    if (mods.length === 0) return makeResult(META, 'warn', 'Sitemap has no <lastmod> dates — agents cannot tell what changed', sm.evidence);
    const parsed = mods.map((d) => Date.parse(d)).filter((t) => !Number.isNaN(t));
    if (parsed.length === 0) return makeResult(META, 'warn', 'lastmod dates present but none parse', sm.evidence);
    const newest = Math.max(...parsed);
    const ageDays = Math.round((Date.now() - newest) / 86400000);
    sm.evidence.note = `${parsed.length} lastmod dates, newest ${ageDays}d old`;
    if (ageDays > 548) return makeResult(META, 'warn', `Newest lastmod is ${ageDays} days old — sitemap looks stale`, sm.evidence);
    return makeResult(META, 'pass', `${parsed.length} valid lastmod dates (newest ${ageDays}d old)`, sm.evidence);
  },
};

export default sitemapLastmod;

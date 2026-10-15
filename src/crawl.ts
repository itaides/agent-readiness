import type { Check, CrawlSummary, HttpClient, CheckRunOptions, Target } from './types';
import { decodeBody } from './checks/_shared';

async function sitemapUrls(target: Target, http: HttpClient, limit: number): Promise<string[]> {
  let res = await http.fetch(new URL('/sitemap.xml', target.origin).toString());
  if (res.status !== 200) {
    try {
      const robotsRes = await http.fetch(new URL('/robots.txt', target.origin).toString());
      if (robotsRes.status === 200) {
        const match = decodeBody(robotsRes.body).match(/^\s*sitemap\s*:\s*(\S+)/im);
        if (match) res = await http.fetch(match[1]);
      }
    } catch { /* best-effort */ }
  }
  if (res.status !== 200) return [];
  // Only sample pages on the target's origin: a sitemap can list any host, and crawling it would
  // send scan traffic to sites the user never named.
  const locs = [...decodeBody(res.body).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((loc) => {
      try { return new URL(loc).origin === target.origin.origin; } catch { return false; }
    });
  // Evenly sample across the sitemap rather than always taking the first N.
  if (locs.length <= limit) return locs;
  const step = locs.length / limit;
  return Array.from({ length: limit }, (_, i) => locs[Math.floor(i * step)]);
}

export async function crawlPages(
  target: Target,
  pageChecks: Check[],
  http: HttpClient,
  maxPages: number,
  options?: CheckRunOptions,
): Promise<CrawlSummary | undefined> {
  if (pageChecks.length === 0 || maxPages <= 0) return undefined;
  const pages = await sitemapUrls(target, http, maxPages);
  if (pages.length === 0) return undefined;

  const perCheck: CrawlSummary['perCheck'] = {};
  for (const c of pageChecks) perCheck[c.id] = { pass: 0, warn: 0, fail: 0 };

  for (const pageUrl of pages) {
    let pageTarget: Target;
    try {
      pageTarget = { ...target, contentUrl: new URL(pageUrl) };
    } catch {
      continue;
    }
    const results = await Promise.all(
      pageChecks.map(async (c) => {
        try {
          return await c.run(pageTarget, http, options);
        } catch {
          return { id: c.id, status: 'fail' as const };
        }
      }),
    );
    for (const r of results) {
      const stat = perCheck[r.id];
      if (!stat) continue;
      if (r.status === 'pass') stat.pass++;
      else if (r.status === 'warn') stat.warn++;
      else if (r.status === 'fail') stat.fail++;
    }
  }
  return { pages, perCheck };
}

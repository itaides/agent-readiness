import type { Evidence, HttpClient, Target } from '../types';
import { decodeBody } from './_shared';

/** Child sitemaps read from a sitemap index. Bounds the requests a large index can cause. */
export const MAX_CHILD_SITEMAPS = 10;

export interface SitemapEntry {
  loc: string;
  hasLastmod: boolean;
}

export interface LoadedSitemap {
  /** The sitemap that was found: /sitemap.xml, or the first Sitemap: URL in robots.txt. */
  url: string;
  status: number;
  evidence: Evidence;
  isIndex: boolean;
  /** Child sitemaps read from an index (same origin only, at most MAX_CHILD_SITEMAPS). */
  children: string[];
  /** Child sitemaps an index listed but that weren't read (other origin or over the limit). */
  skippedChildren: number;
  /** Page entries (<url> blocks) from the sitemap, or from the children of an index. */
  entries: SitemapEntry[];
}

function urlEntries(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<url[\s>][\s\S]*?<\/url>/g)].flatMap((m) => {
    const loc = m[0].match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
    return loc ? [{ loc, hasLastmod: /<lastmod[\s>]/.test(m[0]) }] : [];
  });
}

function sameOrigin(url: string, origin: URL): boolean {
  try { return new URL(url).origin === origin.origin; } catch { return false; }
}

/**
 * Finds the target's sitemap and returns its page entries, following a sitemap index one level down.
 * Children of an index are only read on the target's origin, like the rest of a default scan.
 */
export async function loadSitemap(target: Target, http: HttpClient): Promise<LoadedSitemap> {
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
  const base = { url, status: res.status, evidence, isIndex: false, children: [] as string[], skippedChildren: 0, entries: [] as SitemapEntry[] };
  if (res.status !== 200) return base;

  const body = decodeBody(res.body);
  if (!/<sitemapindex[\s>]/.test(body)) return { ...base, entries: urlEntries(body) };

  const listed = [...body.matchAll(/<sitemap[\s>][\s\S]*?<\/sitemap>/g)]
    .map((m) => m[0].match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1])
    .filter((loc): loc is string => Boolean(loc));
  const children = listed.filter((loc) => sameOrigin(loc, target.origin)).slice(0, MAX_CHILD_SITEMAPS);
  const entries: SitemapEntry[] = [];
  for (const child of children) {
    try {
      const childRes = await http.fetch(child);
      if (childRes.status === 200) entries.push(...urlEntries(decodeBody(childRes.body)));
    } catch { /* an unreadable child doesn't stop the others */ }
  }
  evidence.note = `Sitemap index: read ${children.length} of ${listed.length} listed sitemap(s)`;
  return { ...base, isIndex: true, children, skippedChildren: listed.length - children.length, entries };
}

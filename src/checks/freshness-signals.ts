import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { extractJsonLd, fetchContentPage } from './_page';

const META = {
  id: 'freshness-signals',
  category: 'content' as const,
  title: 'Content freshness signals',
  spec: { url: 'https://agent-ready.dev/what-is-an-agent-ready-website', asOf: '2026-10-13' },
};

function findJsonLdDates(node: unknown, depth = 0): string[] {
  if (depth > 4 || node === null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => findJsonLdDates(n, depth + 1));
  const out: string[] = [];
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (/^date(Modified|Published|Created)$/i.test(k) && typeof v === 'string') out.push(`${k}=${v}`);
    else out.push(...findJsonLdDates(v, depth + 1));
  }
  return out;
}

const freshnessSignals: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    if (page.status !== 200) return makeResult(META, 'warn', `HTTP ${page.status} — could not inspect freshness`, evidence);
    if (page.contentType && !/text\/html/i.test(page.contentType)) {
      return makeResult(META, 'warn', `content-type "${page.contentType}" is not text/html`, evidence);
    }

    const found: string[] = [];
    const { parsed } = extractJsonLd(page.bodyText);
    found.push(...parsed.flatMap((b) => findJsonLdDates(b)).slice(0, 3));
    if (/<time[^>]*\bdatetime\s*=/i.test(page.bodyText)) found.push('<time datetime>');
    const metaDate = page.bodyText.match(/<meta[^>]*(article:modified_time|article:published_time|og:updated_time)[^>]*content\s*=\s*["']([^"']+)["']/i);
    if (metaDate) found.push(`${metaDate[1]}=${metaDate[2]}`);
    const lastModified = page.headers.get('last-modified');
    if (lastModified) found.push(`Last-Modified: ${lastModified}`);

    if (found.length) {
      return makeResult(META, 'pass', `Freshness signals: ${[...new Set(found)].join('; ')}`, evidence);
    }
    return makeResult(META, 'warn', 'No freshness signals — agents cannot tell whether content is current', evidence);
  },
};

export default freshnessSignals;

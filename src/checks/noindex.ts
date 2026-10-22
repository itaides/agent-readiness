import type { Check, CheckResult } from '../types';
import { fetchPage, makeResult } from './_shared';
import { parseHtml } from './_html';

const META = {
  id: 'noindex-directives',
  category: 'discoverability' as const,
  title: 'Homepage not hidden from search (noindex)',
  spec: { url: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag', asOf: '2026-10-22' },
};

const noindex: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchPage(target.contentUrl.toString(), http);
    if (page.status !== 200) return makeResult(META, 'warn', `Homepage returned HTTP ${page.status}`, page.evidence);

    const header = (page.headers.get('x-robots-tag') ?? '').toLowerCase();
    const parsed = parseHtml(page.body);
    const robotsMeta = parsed.metas.filter((m) => m.name === 'robots' || m.name === 'googlebot').map((m) => m.content.toLowerCase());

    const hits: string[] = [];
    if (/noindex|none/.test(header)) hits.push(`X-Robots-Tag: ${header}`);
    for (const c of robotsMeta) if (/noindex|none/.test(c)) hits.push(`meta robots content="${c}"`);

    if (hits.length) return makeResult(META, 'fail', `Page is marked noindex: ${hits.join('; ')}`, page.evidence);
    return makeResult(META, 'pass', 'No noindex directive in headers or meta tags', page.evidence);
  },
};

export default noindex;

import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { fetchContentPage, htmlLinkHrefs, parseLinkHeader } from './_page';

const META = {
  id: 'markdown-link-rel',
  category: 'content' as const,
  title: 'Markdown discovery link relations',
  spec: { url: 'https://llmstxt.org/', asOf: '2026-10-13' },
};

const markdownLinkRel: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    if (page.status !== 200) return makeResult(META, 'warn', `HTTP ${page.status} — could not inspect link relations`, evidence);

    const found: string[] = [];
    for (const link of parseLinkHeader(page.headers.get('link'))) {
      const rel = link.params.rel ?? '';
      if (rel === 'alternate' && link.params.type?.toLowerCase().includes('text/markdown')) found.push('Link rel=alternate type=text/markdown');
      if (rel === 'describedby') found.push('Link rel=describedby');
    }
    if (htmlLinkHrefs(page.bodyText, 'alternate', 'text/markdown').length) found.push('<link rel=alternate type=text/markdown>');
    if (htmlLinkHrefs(page.bodyText, 'describedby').length) found.push('<link rel=describedby>');

    if (found.length) return makeResult(META, 'pass', `Advertised: ${[...new Set(found)].join(', ')}`, evidence);
    return makeResult(META, 'warn', 'No link relations advertising a markdown variant or describing llms.txt coverage', evidence);
  },
};

export default markdownLinkRel;

import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { fetchContentPage } from './_page';

const META = {
  id: 'x-robots-tag',
  category: 'bot-access' as const,
  title: 'X-Robots-Tag agent blocking',
  spec: { url: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag', asOf: '2026-10-13' },
};

const RESTRICTIVE = /(?:^|[,:\s])(noai|noimageai|noindex|nosnippet|none|unavailable_after)(?:\s*[=,]|$)/i;

const xRobotsTag: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    if (page.status !== 200) return makeResult(META, 'fail', `HTTP ${page.status}`, evidence);

    const header = page.headers.get('x-robots-tag');
    if (!header) return makeResult(META, 'pass', 'No X-Robots-Tag restrictions', evidence);

    const restrictive = RESTRICTIVE.test(header);
    // Check for AI-bot-scoped directives (e.g. "GPTBot: noindex")
    const scoped = [...header.matchAll(/([A-Za-z0-9_-]+)\s*:\s*(noai|noindex|nosnippet|none)/gi)]
      .map((m) => `${m[1]}: ${m[2]}`);

    if (restrictive || scoped.length) {
      const detail = scoped.length ? scoped.join('; ') : header;
      return makeResult(META, 'fail', `X-Robots-Tag restricts indexing/agents: ${detail}`, evidence);
    }
    return makeResult(META, 'pass', `X-Robots-Tag present but non-restrictive (${header.slice(0, 60)})`, evidence);
  },
};

export default xRobotsTag;

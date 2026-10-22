import type { Check, CheckResult } from '../types';
import { fetchPage, makeResult } from './_shared';
import { parseLinkHeader } from './ard';

const META = {
  id: 'link-headers-discovery',
  category: 'content' as const,
  title: 'HTTP Link headers for agent discovery',
  spec: { url: 'https://datatracker.ietf.org/doc/html/rfc8288', asOf: '2026-10-22' },
};

const AGENTIC_RELS = ['api-catalog', 'service-doc', 'service-meta', 'ard', 'ai-catalog', 'alternate', 'describedby', 'help', 'status'];

const linkHeadersDiscovery: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchPage(target.contentUrl.toString(), http);
    const header = page.headers.get('link') ?? '';
    const rels = parseLinkHeader(header);
    const useful = rels.filter((r) => AGENTIC_RELS.includes(r.rel) || /markdown|json/i.test(r.type ?? ''));
    page.evidence.note = header ? `Link: ${header.slice(0, 300)}` : 'no Link header';
    if (useful.length) {
      return makeResult(META, 'pass', `Agent-useful Link relations: ${[...new Set(useful.map((r) => r.rel))].join(', ')}`, page.evidence);
    }
    return makeResult(META, 'warn', 'No Link headers pointing agents at sitemap, catalog, or docs', page.evidence);
  },
};

export default linkHeadersDiscovery;

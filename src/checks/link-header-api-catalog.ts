import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';

const META = {
  id: 'link-header-api-catalog',
  category: 'discoverability' as const,
  title: 'Link header advertising api-catalog',
  spec: { url: 'https://datatracker.ietf.org/doc/html/rfc8288', asOf: '2026-04-17' },
};

const linkHeaderApiCatalog: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = target.origin.toString();
    const res = await http.fetch(url);
    const linkHeader = res.headers.get('link') ?? '';
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, finalUrl: res.finalUrl },
      note: linkHeader ? `Link: ${linkHeader.slice(0, 300)}` : 'No Link header on root response',
    };

    if (!linkHeader) return makeResult(META, 'fail', 'No Link header on root response', evidence);
    if (!/rel\s*=\s*"?api-catalog"?/i.test(linkHeader)) {
      return makeResult(META, 'fail', 'Link header present but no rel="api-catalog"', evidence);
    }
    return makeResult(META, 'pass', 'Link header advertises api-catalog', evidence);
  },
};

export default linkHeaderApiCatalog;

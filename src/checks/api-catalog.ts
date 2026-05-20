import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'api-catalog',
  category: 'capabilities' as const,
  title: 'API Catalog (RFC 9727)',
  spec: { url: 'https://datatracker.ietf.org/doc/html/rfc9727', asOf: '2026-04-17' },
};

const apiCatalog: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/api-catalog', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as Record<string, unknown>;
    const links: unknown[] | null = Array.isArray(data)
      ? data
      : Array.isArray((data as { linkset?: unknown[] }).linkset)
        ? (data as { linkset: unknown[] }).linkset
        : null;
    if (!links) return makeResult(META, 'fail', 'JSON parses but no linkset (expected top-level array or { linkset: [...] })', r.evidence);

    return makeResult(META, 'pass', `${links.length} link descriptor(s) in catalog`, r.evidence);
  },
};

export default apiCatalog;

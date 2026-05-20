import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'oauth-protected-resource',
  category: 'capabilities' as const,
  title: 'OAuth 2.0 Protected Resource Metadata (RFC 9728)',
  spec: { url: 'https://datatracker.ietf.org/doc/html/rfc9728', asOf: '2026-04-17' },
};

const oauthProtectedResource: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/oauth-protected-resource', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as { resource?: unknown };
    if (typeof data.resource !== 'string' || !data.resource) {
      return makeResult(META, 'fail', 'JSON missing required "resource" field', r.evidence);
    }
    return makeResult(META, 'pass', `resource: ${data.resource}`, r.evidence);
  },
};

export default oauthProtectedResource;

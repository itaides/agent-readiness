import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'oauth-authorization-server',
  category: 'capabilities' as const,
  title: 'OAuth 2.0 Authorization Server Metadata (RFC 8414)',
  spec: { url: 'https://datatracker.ietf.org/doc/html/rfc8414', asOf: '2026-04-17' },
};

const oauthAuthorizationServer: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/oauth-authorization-server', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as { issuer?: unknown };
    if (typeof data.issuer !== 'string' || !data.issuer) {
      return makeResult(META, 'fail', 'JSON missing required "issuer" field', r.evidence);
    }
    return makeResult(META, 'pass', `issuer: ${data.issuer}`, r.evidence);
  },
};

export default oauthAuthorizationServer;

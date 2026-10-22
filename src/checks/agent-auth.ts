import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, fetchText, getEvidence, isRecord, makeResult } from './_shared';
import { getOAuthDocs } from './oauth-quality';

// WorkOS auth.md agent_auth profile: an agent_auth block inside RFC 8414
// authorization-server metadata, plus WWW-Authenticate resource_metadata hints.

const SPEC = { url: 'https://workos.com/auth-md/docs/auth-md', asOf: '2026-10-22' };

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

export const agentAuthDiscoveryMetadata: Check = {
  ...meta('agent-auth-discovery-metadata', 'Agent auth discovery metadata'),
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('agent-auth-discovery-metadata', 'Agent auth discovery metadata');
    const { as, pr } = await getOAuthDocs(target, http);
    if (!as && !pr) return makeResult(m, 'skip', 'No OAuth metadata documents found', {});
    const agentAuth = as && isRecord(as.agent_auth) ? as.agent_auth : null;
    if (!agentAuth) return makeResult(m, 'warn', 'OAuth metadata lacks an agent_auth block', {});
    const missing: string[] = [];
    if (!agentAuth.skill && !agentAuth.identity_endpoint) missing.push('skill/identity_endpoint');
    if (missing.length) return makeResult(m, 'warn', `agent_auth present but missing ${missing.join(', ')}`, {});
    return makeResult(m, 'pass', 'agent_auth block with identity/claim endpoints in AS metadata', {});
  },
};

export const agentAuthWwwAuthenticate: Check = {
  ...meta('agent-auth-www-authenticate', 'WWW-Authenticate agent hint on 401'),
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('agent-auth-www-authenticate', 'WWW-Authenticate agent hint on 401');
    // Look for a protected endpoint: probe API-ish paths until one returns 401.
    const candidates = ['/api', '/api/v1', '/v1', '/api/me', '/api/v1/me'];
    for (const path of candidates) {
      const url = new URL(path, target.origin).toString();
      try {
        const res = await fetchText(url, http, { headers: { Authorization: 'Bearer invalid-probe' } });
        if (res.status !== 401) continue;
        const wwwAuth = res.headers.get('www-authenticate') ?? '';
        const evidence = getEvidence('GET', url, res, `WWW-Authenticate: ${wwwAuth.slice(0, 160)}`, { Authorization: 'Bearer <invalid>' });
        if (/resource_metadata\s*=/.test(wwwAuth)) {
          return makeResult(m, 'pass', '401 response includes resource_metadata pointer (RFC 9728)', evidence);
        }
        return makeResult(m, 'warn', `401 found but WWW-Authenticate lacks resource_metadata: ${wwwAuth.slice(0, 120) || '(empty)'}`, evidence);
      } catch { /* next */ }
    }
    return makeResult(m, 'skip', 'No 401-protected endpoint found to probe', {});
  },
};

export const agentAuthEndpointsReachable: Check = {
  ...meta('agent-auth-endpoints-reachable', 'agent_auth endpoints reachable'),
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('agent-auth-endpoints-reachable', 'agent_auth endpoints reachable');
    const { as } = await getOAuthDocs(target, http);
    const agentAuth = as && isRecord(as.agent_auth) ? as.agent_auth : null;
    if (!agentAuth) return makeResult(m, 'skip', 'No agent_auth metadata to check', {});
    const urls = [agentAuth.identity_endpoint, agentAuth.claim_endpoint, agentAuth.events_endpoint]
      .filter((u): u is string => typeof u === 'string');
    if (urls.length === 0) return makeResult(m, 'warn', 'agent_auth block declares no endpoints', {});
    const dead: string[] = [];
    for (const u of urls.slice(0, 4)) {
      try {
        const res = await fetchText(u, http, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (res.status === 404 || res.status >= 500) dead.push(`${u} (HTTP ${res.status})`);
      } catch {
        dead.push(`${u} (unreachable)`);
      }
    }
    if (dead.length) return makeResult(m, 'warn', `Advertised endpoints not responding: ${dead.join(', ')}`, {});
    return makeResult(m, 'pass', `${urls.length} advertised agent_auth endpoint(s) respond`, {});
  },
};

import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchJsonWellKnown, fetchText, getEvidence, isRecord, makeResult, memoize } from './_shared';

// Personal Agent Protocol ("Poppy") — draft 0.2. Discovery document at
// /.well-known/poppy.json; all six checks share one fetch.

const SPEC = { url: 'https://personalagentprotocol.org/docs/spec', asOf: '2026-10-22' };

interface PoppyDoc { data: Record<string, unknown>; url: string; evidence: Evidence }

function getPoppy(target: Target, http: HttpClient): Promise<PoppyDoc | null> {
  return memoize(`poppy:${target.origin}`, async () => {
    const url = new URL('/.well-known/poppy.json', target.origin).toString();
    const res = await fetchText(url, http);
    const evidence = getEvidence('GET', url, res);
    if (res.status !== 200 || !/json/i.test(res.contentType)) return null;
    try {
      const d = JSON.parse(res.text);
      return isRecord(d) ? { data: d, url, evidence } : null;
    } catch { return null; }
  });
}

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

function org(d: Record<string, unknown>): Record<string, unknown> {
  return isRecord(d.organization) ? d.organization : {};
}

export const papDiscovery: Check = {
  ...meta('pap-discovery', 'PAP discovery file (poppy.json)'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-discovery', 'PAP discovery file (poppy.json)');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'warn', 'No /.well-known/poppy.json (Personal Agent Protocol discovery)', {});
    const d = poppy.data;
    const problems: string[] = [];
    if (typeof d.protocol_version !== 'string') problems.push('protocol_version');
    const o = org(d);
    if (typeof o.name !== 'string' || typeof o.domain !== 'string') problems.push('organization.name/domain');
    if (typeof o.domain === 'string' && o.domain.toLowerCase() !== target.origin.hostname.toLowerCase()) {
      problems.push(`organization.domain "${o.domain}" != serving host ${target.origin.hostname}`);
    }
    const hasInterface = isRecord(d.agent) || Array.isArray(d.apis) || isRecord(d.web);
    if (!hasInterface) problems.push('one of agent/apis/web');
    const needsAuth = isRecord(d.agent) || (Array.isArray(d.apis) && d.apis.length) || (isRecord(d.web) && d.web.browser_session_endpoint);
    if (needsAuth && !isRecord(d.auth)) problems.push('auth (required once interfaces are listed)');
    if (problems.length) return makeResult(m, 'warn', `poppy.json issues: ${problems.join('; ')}`, poppy.evidence);
    return makeResult(m, 'pass', `Valid poppy.json v${String(d.protocol_version)} for ${String(o.domain)}`, poppy.evidence);
  },
};

export const papIssuerBinding: Check = {
  ...meta('pap-issuer-binding', 'PAP issuer binding'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-issuer-binding', 'PAP issuer binding');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'skip', 'No poppy.json', {});
    const auth = isRecord(poppy.data.auth) ? poppy.data.auth : null;
    const issuer = auth?.issuer;
    if (typeof issuer !== 'string') return makeResult(m, 'skip', 'poppy.json has no auth.issuer (no sign-in surfaces)', {});
    try {
      const metaUrl = new URL('/.well-known/oauth-authorization-server', issuer).toString();
      const res = await fetchText(metaUrl, http);
      if (res.status !== 200) return makeResult(m, 'warn', `Issuer metadata unreachable (HTTP ${res.status})`, getEvidence('GET', metaUrl, res));
      const meta = JSON.parse(res.text);
      if (!isRecord(meta)) return makeResult(m, 'warn', 'Issuer metadata is not a JSON object', getEvidence('GET', metaUrl, res));
      const problems: string[] = [];
      if (meta.issuer !== issuer.replace(/\/$/, '') && meta.issuer !== issuer) problems.push(`issuer mismatch (${String(meta.issuer)})`);
      const domains = Array.isArray(meta.poppy_domains) ? meta.poppy_domains : [];
      if (domains.length && !domains.includes(target.origin.hostname)) problems.push('poppy_domains does not list this host');
      if (!meta.token_endpoint) problems.push('no token_endpoint');
      if (problems.length) return makeResult(m, 'warn', problems.join('; '), getEvidence('GET', metaUrl, res));
      return makeResult(m, 'pass', 'Issuer metadata binds this domain (poppy_domains) and matches issuer', getEvidence('GET', metaUrl, res));
    } catch {
      return makeResult(m, 'warn', 'Could not fetch issuer OAuth metadata', {});
    }
  },
};

export const papAuthConfig: Check = {
  ...meta('pap-auth-config', 'PAP sign-in config'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-auth-config', 'PAP sign-in config');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'skip', 'No poppy.json', {});
    const auth = isRecord(poppy.data.auth) ? poppy.data.auth : null;
    if (!auth) return makeResult(m, 'skip', 'No auth block required', {});
    const problems: string[] = [];
    for (const kind of ['direct', 'device', 'mediated']) {
      const cfg = auth[kind];
      if (cfg === undefined) continue;
      if (!isRecord(cfg) || !Array.isArray(cfg.scopes) || cfg.scopes.length === 0) problems.push(`${kind} missing scopes`);
    }
    const extensions = isRecord(poppy.data.extensions) ? poppy.data.extensions : null;
    if (extensions) {
      for (const [name, ext] of Object.entries(extensions)) {
        if (isRecord(ext) && !ext.version) problems.push(`extension "${name}" missing version`);
      }
    }
    const types = ['direct', 'device', 'mediated'].filter((k) => auth[k] !== undefined);
    if (problems.length) return makeResult(m, 'warn', problems.join('; '), poppy.evidence);
    return makeResult(m, 'pass', `Sign-in types: ${types.join(', ') || 'none declared'}`, poppy.evidence);
  },
};

export const papInterfaces: Check = {
  ...meta('pap-interfaces', 'PAP interface completeness'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-interfaces', 'PAP interface completeness');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'skip', 'No poppy.json', {});
    const d = poppy.data;
    const problems: string[] = [];
    if (isRecord(d.agent)) {
      const protos = Array.isArray(d.agent.protocols) ? d.agent.protocols : [];
      protos.forEach((p, i) => {
        if (!isRecord(p) || typeof p.type !== 'string' || typeof p.endpoint !== 'string') problems.push(`agent.protocols[${i}] needs type+endpoint`);
      });
    }
    if (Array.isArray(d.apis)) {
      for (const [i, api] of d.apis.entries()) {
        if (!isRecord(api) || typeof api.url !== 'string') { problems.push(`apis[${i}] missing url`); continue; }
        if (api.type === 'openapi') {
          try {
            const res = await fetchText(api.url as string, http);
            const isSpec = res.status === 200 && (/"openapi"\s*:\s*"3\.|openapi:\s*3\./.test(res.text));
            if (!isSpec) problems.push(`apis[${i}].url does not serve OpenAPI 3.x (HTTP ${res.status})`);
          } catch {
            problems.push(`apis[${i}].url unreachable`);
          }
        }
        if (typeof api.description !== 'string' || !api.description) problems.push(`apis[${i}] missing description`);
      }
    }
    if (problems.length) return makeResult(m, 'warn', problems.slice(0, 4).join('; '), poppy.evidence);
    return makeResult(m, 'pass', 'PAP interfaces complete and OpenAPI entries serve valid specs', poppy.evidence);
  },
};

export const papEndpointEnforcement: Check = {
  ...meta('pap-endpoint-enforcement', 'PAP endpoints reject unauthenticated agents'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-endpoint-enforcement', 'PAP endpoints reject unauthenticated agents');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'skip', 'No poppy.json', {});
    const d = poppy.data;
    const endpoints: string[] = [];
    if (isRecord(d.agent) && Array.isArray(d.agent.protocols)) {
      for (const p of d.agent.protocols) if (isRecord(p) && typeof p.endpoint === 'string') endpoints.push(p.endpoint);
    }
    if (isRecord(d.web) && typeof d.web.browser_session_endpoint === 'string') endpoints.push(d.web.browser_session_endpoint);
    if (endpoints.length === 0) return makeResult(m, 'skip', 'No PAP endpoints to probe', {});
    const open: string[] = [];
    for (const ep of endpoints.slice(0, 4)) {
      try {
        const res = await fetchText(ep, http, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (res.status === 200) open.push(`${ep} accepted unauthenticated request`);
      } catch { /* unreachable is fine for enforcement */ }
    }
    if (open.length) return makeResult(m, 'warn', open.join('; '), poppy.evidence);
    return makeResult(m, 'pass', `${Math.min(endpoints.length, 4)} PAP endpoint(s) reject unauthenticated calls`, poppy.evidence);
  },
};

export const papCrossProtocol: Check = {
  ...meta('pap-cross-protocol', 'PAP cross-protocol consistency'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pap-cross-protocol', 'PAP cross-protocol consistency');
    const poppy = await getPoppy(target, http);
    if (!poppy) return makeResult(m, 'skip', 'No poppy.json', {});
    const checks: string[] = [];
    const problems: string[] = [];
    // Same MCP server in ARD catalog?
    const ard = await fetchJsonWellKnown(target.origin, '/.well-known/ard.json', http);
    const poppyMcp = (Array.isArray(poppy.data.apis) ? poppy.data.apis : [])
      .filter(isRecord).filter((a) => a.type === 'mcp').map((a) => String(a.url));
    if (ard.ok && poppyMcp.length) {
      checks.push('ard mcp entry');
      const ardText = JSON.stringify(ard.data);
      for (const m of poppyMcp) if (!ardText.includes(m)) problems.push(`MCP ${m} not in ARD catalog`);
    }
    // auth.md agreement
    const authMd = await fetchText(new URL('/auth.md', target.origin).toString(), http);
    if (authMd.status === 200) {
      checks.push('auth.md');
      const issuer = isRecord(poppy.data.auth) ? poppy.data.auth.issuer : undefined;
      if (typeof issuer === 'string' && !authMd.text.includes(new URL(issuer).hostname)) {
        problems.push('auth.md does not reference the PAP issuer');
      }
    }
    const note = checks.length ? `compared with: ${checks.join(', ')}` : 'no cross-references available';
    if (problems.length) return makeResult(m, 'warn', `${problems.join('; ')} (${note})`, poppy.evidence);
    return makeResult(m, 'pass', `poppy.json consistent with other agent surfaces (${note})`, poppy.evidence);
  },
};

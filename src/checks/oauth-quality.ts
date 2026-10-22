import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchJsonWellKnown, isRecord, makeResult, memoize } from './_shared';
import { getOpenApi } from './_openapi';

const RFC8414 = { url: 'https://datatracker.ietf.org/doc/html/rfc8414', asOf: '2026-10-22' };
const RFC9728 = { url: 'https://datatracker.ietf.org/doc/html/rfc9728', asOf: '2026-10-22' };

interface OAuthDocs {
  as: Record<string, unknown> | null;
  pr: Record<string, unknown> | null;
}

function getOAuthDocs(target: Target, http: HttpClient): Promise<OAuthDocs> {
  return memoize(`oauthdocs:${target.origin}`, async () => {
    const as = await fetchJsonWellKnown(target.origin, '/.well-known/oauth-authorization-server', http);
    const pr = await fetchJsonWellKnown(target.origin, '/.well-known/oauth-protected-resource', http);
    return {
      as: as.ok && isRecord(as.data) ? as.data : null,
      pr: pr.ok && isRecord(pr.data) ? pr.data : null,
    };
  });
}

export { getOAuthDocs };

export const oauthSupport: Check = {
  id: 'oauth-support',
  category: 'capabilities',
  title: 'OAuth 2.0 support',
  spec: RFC8414,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'oauth-support', category: 'capabilities' as const, title: 'OAuth 2.0 support', spec: RFC8414 };
    const { as, pr } = await getOAuthDocs(target, http);
    if (as && typeof as.issuer === 'string' && typeof as.token_endpoint === 'string') {
      const grants = Array.isArray(as.grant_types_supported) ? as.grant_types_supported.length : 0;
      return makeResult(meta, 'pass', `OAuth AS metadata with token endpoint${grants ? ` and ${grants} grant types` : ''}`, {});
    }
    if (as || pr) return makeResult(meta, 'warn', 'Partial OAuth metadata (issuer/token_endpoint incomplete)', {});
    const spec = await getOpenApi(target, http);
    if (spec?.doc) {
      const sec = isRecord(spec.doc.components) ? (spec.doc.components as Record<string, unknown>).securitySchemes : undefined;
      const schemes = isRecord(sec) ? Object.values(sec) : [];
      if (schemes.some((s) => isRecord(s) && (s.type === 'oauth2' || s.type === 'openIdConnect'))) {
        return makeResult(meta, 'pass', 'OAuth declared in OpenAPI security schemes', {});
      }
    }
    return makeResult(meta, 'warn', 'No OAuth 2.0 metadata or security scheme found', {});
  },
};

export const scopedPermissions: Check = {
  id: 'scoped-permissions',
  category: 'capabilities',
  title: 'Scoped permissions (declared scopes)',
  spec: RFC9728,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'scoped-permissions', category: 'capabilities' as const, title: 'Scoped permissions (declared scopes)', spec: RFC9728 };
    const { as, pr } = await getOAuthDocs(target, http);
    const scopes = (doc: Record<string, unknown> | null) =>
      doc && Array.isArray(doc.scopes_supported) ? (doc.scopes_supported as unknown[]).filter((s) => typeof s === 'string') : [];
    const found = [...scopes(as), ...scopes(pr)];
    if (found.length) return makeResult(meta, 'pass', `${new Set(found).size} declared scopes`, {});
    const spec = await getOpenApi(target, http);
    if (spec?.doc) {
      const sec = isRecord(spec.doc.components) ? (spec.doc.components as Record<string, unknown>).securitySchemes : undefined;
      if (isRecord(sec)) {
        for (const scheme of Object.values(sec)) {
          if (!isRecord(scheme)) continue;
          const flows = isRecord(scheme.flows) ? Object.values(scheme.flows) : [];
          for (const f of flows) {
            const sc = isRecord(f) ? f.scopes : undefined;
            if (isRecord(sc) && Object.keys(sc).length > 0) {
              return makeResult(meta, 'pass', `${Object.keys(sc).length} OAuth scopes declared in OpenAPI`, {});
            }
          }
        }
      }
    }
    return makeResult(meta, 'warn', 'No declared OAuth scopes (metadata or OpenAPI security schemes)', {});
  },
};

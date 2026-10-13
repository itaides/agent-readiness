import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'openapi-discovery',
  category: 'capabilities' as const,
  title: 'OpenAPI spec discovery',
  spec: { url: 'https://spec.openapis.org/oas/latest.html', asOf: '2026-10-13' },
};

const CANDIDATES = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
  '/api/openapi.json',
  '/api-docs',
  '/docs/openapi.json',
  '/.well-known/openapi.json',
];

function looksLikeOpenApi(text: string, contentType: string): string | null {
  if (/json/i.test(contentType)) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      const v = (data.openapi ?? data.swagger) as string | undefined;
      if (typeof v === 'string') return `OpenAPI ${v}`;
    } catch { /* not json */ }
    return null;
  }
  if (/ya?ml|text\/plain/i.test(contentType) || text.trimStart().startsWith('openapi:') || text.trimStart().startsWith('swagger:')) {
    const m = text.match(/^\s*(?:openapi|swagger)\s*:\s*["']?([\d.]+)/m);
    if (m) return `OpenAPI ${m[1]}`;
  }
  return null;
}

const openapiDiscovery: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    for (const path of CANDIDATES) {
      const url = new URL(path, target.origin).toString();
      const res = await http.fetch(url);
      if (res.status !== 200) continue;
      const bodyText = decodeBody(res.body);
      const found = looksLikeOpenApi(bodyText, res.contentType);
      if (!found) continue;
      const evidence: Evidence = {
        request: { method: 'GET', url },
        response: { status: res.status, contentType: res.contentType, bytes: res.body.length },
      };
      return makeResult(META, 'pass', `${found} at ${path}`, evidence);
    }
    const evidence: Evidence = {
      request: { method: 'GET', url: new URL('/openapi.json', target.origin).toString() },
      note: `Tried: ${CANDIDATES.join(', ')}`,
    };
    return makeResult(META, 'fail', 'No OpenAPI/Swagger spec found at common paths', evidence);
  },
};

export default openapiDiscovery;

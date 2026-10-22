import type { HttpClient, Target } from '../types';
import { fetchText, isRecord, memoize } from './_shared';

export interface OpenApiDoc {
  url: string;
  raw: string;
  doc: Record<string, unknown> | null; // null when unparseable or YAML
  yamlText: string | null;
  evidenceNote?: string;
}

const CANDIDATE_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/api/openapi.json',
  '/api-docs',
  '/api-docs.json',
  '/swagger.json',
  '/v3/api-docs',
  '/v3/api-docs/swagger-config',
  '/.well-known/openapi.json',
  '/docs/openapi.json',
];

function looksLikeSpec(text: string, contentType: string): { doc: Record<string, unknown> | null; yaml: boolean } | null {
  if (/json/i.test(contentType) || /^[{[]/.test(text.trim())) {
    try {
      const d = JSON.parse(text);
      if (isRecord(d) && (typeof d.openapi === 'string' || typeof d.swagger === 'string') && isRecord(d.paths)) {
        return { doc: d, yaml: false };
      }
      // springdoc swagger-config points at the real doc
      if (isRecord(d) && Array.isArray(d.urls)) return null;
    } catch { /* not json */ }
    return null;
  }
  if (/(?:^|\n)\s*(openapi|swagger)\s*:/m.test(text) && /(?:^|\n)\s*paths\s*:/m.test(text)) {
    return { doc: null, yaml: true };
  }
  return null;
}

async function discover(target: Target, http: HttpClient): Promise<OpenApiDoc | null> {
  // 1) RFC 9727 api-catalog linkset → service-desc/service-doc entries
  try {
    const cat = await fetchText(new URL('/.well-known/api-catalog', target.origin).toString(), http);
    if (cat.status === 200 && /json|linkset/i.test(cat.contentType)) {
      try {
        const parsed = JSON.parse(cat.text);
        const linkset = Array.isArray(parsed) ? parsed : (isRecord(parsed) && Array.isArray(parsed.linkset) ? parsed.linkset : []);
        for (const entry of linkset) {
          if (!isRecord(entry)) continue;
          const rel = String(entry.rel ?? '');
          const href = entry.href ?? entry.anchor;
          if (/service-desc|service-doc|openapi|swagger/i.test(rel) && typeof href === 'string') {
            const u = new URL(href, target.origin).toString();
            const res = await fetchText(u, http);
            if (res.status === 200) {
              const ok = looksLikeSpec(res.text, res.contentType);
              if (ok) return { url: u, raw: res.text, doc: ok.doc, yamlText: ok.yaml ? res.text : null, evidenceNote: 'discovered via api-catalog' };
            }
          }
        }
      } catch { /* not json */ }
    }
  } catch { /* continue to path probing */ }

  // 2) common well-known paths
  for (const path of CANDIDATE_PATHS) {
    const u = new URL(path, target.origin).toString();
    try {
      const res = await fetchText(u, http);
      if (res.status !== 200) continue;
      const ok = looksLikeSpec(res.text, res.contentType);
      if (ok) return { url: u, raw: res.text, doc: ok.doc, yamlText: ok.yaml ? res.text : null, evidenceNote: `found at ${path}` };
    } catch { /* next path */ }
  }
  return null;
}

export function getOpenApi(target: Target, http: HttpClient): Promise<OpenApiDoc | null> {
  return memoize(`openapi:${target.origin}`, () => discover(target, http));
}

// --- shared spec inspection helpers (work on parsed JSON OpenAPI docs) ---

export function operations(spec: OpenApiDoc): { path: string; method: string; op: Record<string, unknown> }[] {
  const out: { path: string; method: string; op: Record<string, unknown> }[] = [];
  const paths = spec.doc?.paths;
  if (!isRecord(paths)) return out;
  for (const [path, item] of Object.entries(paths)) {
    if (!isRecord(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method) && isRecord(op)) {
        out.push({ path, method, op });
      }
    }
  }
  return out;
}

export function opParams(op: Record<string, unknown>): Record<string, unknown>[] {
  const p = op.parameters;
  return Array.isArray(p) ? p.filter(isRecord) : [];
}

export function opResponses(op: Record<string, unknown>): Record<string, unknown> {
  return isRecord(op.responses) ? op.responses : {};
}

export function specText(spec: OpenApiDoc): string {
  return spec.yamlText ?? spec.raw;
}

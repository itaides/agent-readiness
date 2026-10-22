import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchText, getEvidence, isRecord, makeResult } from './_shared';
import { getOpenApi, operations, opParams, opResponses, specText, type OpenApiDoc } from './_openapi';

const SPEC = { url: 'https://spec.openapis.org/oas/latest.html', asOf: '2026-10-22' };

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

async function specOr(target: Target, http: HttpClient, m: ReturnType<typeof meta>): Promise<{ spec: OpenApiDoc } | { result: CheckResult }> {
  const spec = await getOpenApi(target, http);
  if (!spec) return { result: makeResult(m, 'skip', 'No OpenAPI spec discovered — check not applicable', {}) };
  return { spec };
}

// Resolve an API base for live probes: spec servers[0] else origin.
function apiBase(spec: OpenApiDoc, target: Target): { base: string; samplePath: string | null } {
  const servers = spec.doc?.servers;
  const first = isRecord(spec.doc?.paths) ? Object.keys(spec.doc!.paths as Record<string, unknown>)[0] : undefined;
  if (Array.isArray(servers) && isRecord(servers[0]) && typeof servers[0].url === 'string') {
    const base = new URL(servers[0].url as string, target.origin).toString().replace(/\/$/, '');
    return { base, samplePath: first ?? null };
  }
  return { base: target.origin.toString().replace(/\/$/, ''), samplePath: first ?? null };
}

function firstGetPath(spec: OpenApiDoc): { path: string; url: (t: Target) => string } | null {
  const op = operations(spec).find((o) => o.method === 'get');
  if (!op) return null;
  const rel = op.path.replace(/\{[^}]+\}/g, 'test');
  return {
    path: op.path,
    url: (t) => `${apiBase(spec, t).base}${rel.startsWith('/') ? rel : '/' + rel}`,
  };
}

export const openapiSpec: Check = {
  ...meta('openapi-spec', 'OpenAPI spec published'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('openapi-spec', 'OpenAPI spec published');
    const spec = await getOpenApi(target, http);
    if (!spec) return makeResult(m, 'warn', 'No OpenAPI spec found at common paths or via api-catalog', {});
    const version = spec.doc ? String(spec.doc.openapi ?? spec.doc.swagger ?? '?') : 'yaml';
    return makeResult(m, 'pass', `OpenAPI ${version} at ${new URL(spec.url).pathname} (${spec.evidenceNote})`, {});
  },
};

export const publicApi: Check = {
  ...meta('public-api', 'Public API with reachable endpoints'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('public-api', 'Public API with reachable endpoints');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const probe = firstGetPath(got.spec);
    if (!probe) return makeResult(m, 'warn', 'OpenAPI spec has no GET operations to probe', {});
    const url = probe.url(target);
    const res = await fetchText(url, http);
    const evidence = getEvidence('GET', url, res, `probed ${probe.path}`);
    if (res.status < 500) {
      return makeResult(m, 'pass', `API endpoint ${probe.path} responds (HTTP ${res.status})`, evidence);
    }
    return makeResult(m, 'warn', `API endpoint ${probe.path} returned HTTP ${res.status}`, evidence);
  },
};

export const responseSchemaCoverage: Check = {
  ...meta('response-schema-coverage', 'REST response schema coverage'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('response-schema-coverage', 'REST response schema coverage');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    if (!got.spec.doc) return makeResult(m, 'skip', 'YAML spec — structural checks skipped', {});
    const ops = operations(got.spec);
    if (ops.length === 0) return makeResult(m, 'skip', 'No operations in spec', {});
    const typed = ops.filter((o) => Object.values(opResponses(o.op)).some((r) => isRecord(r) && isRecord(r.content))).length;
    const pct = Math.round((typed / ops.length) * 100);
    if (pct >= 80) return makeResult(m, 'pass', `${pct}% of ${ops.length} operations declare response schemas`, {});
    if (pct >= 50) return makeResult(m, 'warn', `${pct}% of operations declare response schemas`, {});
    return makeResult(m, 'warn', `Only ${pct}% of operations declare response schemas`, {});
  },
};

export const apiErrorModel: Check = {
  ...meta('api-error-model', 'REST typed error model'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('api-error-model', 'REST typed error model');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const text = specText(got.spec);
    const problemJson = /application\/problem\+json/i.test(text);
    const schemaNames = isRecord(got.spec.doc?.components) && isRecord((got.spec.doc!.components as Record<string, unknown>).schemas)
      ? Object.keys((got.spec.doc!.components as Record<string, unknown>).schemas as Record<string, unknown>) : [];
    const typedErrors = schemaNames.some((n) => /error|problem/i.test(n));
    const defaultResponses = operations(got.spec).some((o) => 'default' in opResponses(o.op));
    if (problemJson || typedErrors || defaultResponses) {
      const how = [problemJson && 'problem+json', typedErrors && 'error schema', defaultResponses && 'default responses'].filter(Boolean).join(', ');
      return makeResult(m, 'pass', `Typed error model found (${how})`, {});
    }
    return makeResult(m, 'warn', 'No typed error schema or default error responses in spec', {});
  },
};

export const apiVersioningPolicy: Check = {
  ...meta('api-versioning-policy', 'REST versioning / deprecation policy'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('api-versioning-policy', 'REST versioning / deprecation policy');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const text = specText(got.spec);
    const versionedPaths = /\/v\d+(\.\d+)?(\/|["'\s]|$)/.test(text);
    const deprecated = /deprecated\s*:\s*true/i.test(text) || /"deprecated"\s*:\s*true/.test(text);
    const versionHeaders = /api[-_]?version|x-api-version|deprecation|sunset/i.test(text);
    if (versionedPaths || deprecated || versionHeaders) {
      const how = [versionedPaths && 'versioned paths', deprecated && 'deprecation flags', versionHeaders && 'version headers'].filter(Boolean).join(', ');
      return makeResult(m, 'pass', `Versioning signals: ${how}`, {});
    }
    return makeResult(m, 'warn', 'No versioned paths, deprecation flags, or version headers found', {});
  },
};

export const paginationShape: Check = {
  ...meta('pagination-shape', 'REST pagination pattern'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('pagination-shape', 'REST pagination pattern');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const text = specText(got.spec);
    const cursor = /cursor|pageToken|next_token|after/i.test(text);
    const offset = /\b(offset|limit|page(_size|_number)?|per_page)\b/i.test(text);
    const linkHeader = /rel\s*[=:]\s*["']?next/i.test(text);
    if (cursor) return makeResult(m, 'pass', 'Cursor-based pagination detected', {});
    if (offset || linkHeader) return makeResult(m, 'pass', 'Offset/page pagination detected', {});
    return makeResult(m, 'warn', 'No pagination parameters found — list endpoints may truncate silently', {});
  },
};

export const asyncJobPattern: Check = {
  ...meta('async-job-pattern', 'REST async-job pattern'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('async-job-pattern', 'REST async-job pattern');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const text = specText(got.spec);
    if (/"?202"?|accepted|\/(jobs?|operations?|tasks?|status)\b/i.test(text)) {
      return makeResult(m, 'pass', 'Async job pattern detected (202/status/polling paths)', {});
    }
    return makeResult(m, 'warn', 'No async job pattern (202 + polling) found — long operations may look hung', {});
  },
};

export const batchEndpoints: Check = {
  ...meta('batch-endpoints', 'REST batch / bulk endpoints'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('batch-endpoints', 'REST batch / bulk endpoints');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    const text = specText(got.spec);
    if (/\/(batch|bulk)\b|batchRequest|bulk_|"type"\s*:\s*"array"[\s\S]{0,200}requestBody/i.test(text)) {
      return makeResult(m, 'pass', 'Batch/bulk operations detected', {});
    }
    return makeResult(m, 'warn', 'No batch endpoints — agents must loop one call at a time', {});
  },
};

export const idempotencyKeySupport: Check = {
  ...meta('idempotency-key-support', 'Idempotency-Key support'),
  spec: { url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = { id: 'idempotency-key-support', category: 'capabilities' as const, title: 'Idempotency-Key support', spec: { url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/', asOf: '2026-10-22' } };
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    if (/idempotency[-_]?key/i.test(specText(got.spec))) {
      return makeResult(m, 'pass', 'Idempotency-Key header declared in spec', {});
    }
    const writeOps = operations(got.spec).filter((o) => ['post', 'put', 'patch'].includes(o.method));
    if (writeOps.length === 0) return makeResult(m, 'skip', 'No write operations to protect', {});
    return makeResult(m, 'warn', `${writeOps.length} write operations, none accept Idempotency-Key`, {});
  },
};

export const functionCallingCompat: Check = {
  ...meta('function-calling-compat', 'Function calling compatibility'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('function-calling-compat', 'Function calling compatibility');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    if (!got.spec.doc) return makeResult(m, 'skip', 'YAML spec — structural checks skipped', {});
    const ops = operations(got.spec);
    if (ops.length === 0) return makeResult(m, 'skip', 'No operations in spec', {});
    const named = ops.filter((o) => typeof o.op.operationId === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(o.op.operationId as string)).length;
    const described = ops.filter((o) => o.op.summary || o.op.description).length;
    const pct = Math.round((named / ops.length) * 100);
    if (pct >= 80 && described >= ops.length * 0.6) {
      return makeResult(m, 'pass', `${pct}% operationIds + descriptions — translates cleanly to function calls`, {});
    }
    return makeResult(m, 'warn', `${pct}% operationIds, ${described}/${ops.length} described — weak function-calling surface`, {});
  },
};

export const apiSchemaAnalysis: Check = {
  ...meta('api-schema-analysis', 'API schema complexity analysis'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('api-schema-analysis', 'API schema complexity analysis');
    const got = await specOr(target, http, m);
    if ('result' in got) return got.result;
    if (!got.spec.doc) return makeResult(m, 'skip', 'YAML spec — structural checks skipped', {});
    const ops = operations(got.spec);
    const maxDepth = (() => {
      let max = 0;
      const seen = new Set<unknown>();
      const walk = (v: unknown, d: number) => {
        if (d > 12 || typeof v !== 'object' || v === null || seen.has(v)) return;
        seen.add(v);
        max = Math.max(max, d);
        for (const val of Object.values(v)) walk(val, d + 1);
      };
      walk(got.spec.doc.components ?? {}, 0);
      return max;
    })();
    const note = `${ops.length} operations, schema depth ~${maxDepth}`;
    if (ops.length > 120 || maxDepth > 8) return makeResult(m, 'warn', `${note} — high complexity for agents`, {});
    return makeResult(m, 'pass', note, {});
  },
};

export const jsonErrorResponses: Check = {
  ...meta('json-error-responses', 'JSON error responses'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('json-error-responses', 'JSON error responses');
    const spec = await getOpenApi(target, http);
    let base: string | null = null;
    if (spec) {
      const b = apiBase(spec, target);
      base = `${b.base}/agent-readiness-probe-404`;
    }
    if (!base) base = new URL('/api/agent-readiness-probe-404', target.origin).toString();
    const res = await fetchText(base, http, { headers: { Accept: 'application/json' } });
    const evidence = getEvidence('GET', base, res);
    if (res.status === 404 || res.status === 400 || res.status === 422) {
      if (/json|problem/i.test(res.contentType)) return makeResult(m, 'pass', `API errors return structured JSON (${res.contentType})`, evidence);
      if (!spec) return makeResult(m, 'warn', `Error path returned ${res.contentType}, not JSON`, evidence);
      return makeResult(m, 'warn', `Error response content-type "${res.contentType}" — not JSON`, evidence);
    }
    if (!spec) return makeResult(m, 'skip', `No API surface detected (probe returned HTTP ${res.status})`, evidence);
    return makeResult(m, 'warn', `Error probe returned HTTP ${res.status} (${res.contentType})`, evidence);
  },
};

export const rateLimitHeaders: Check = {
  ...meta('rate-limit-headers', 'Rate limit response headers'),
  spec: { url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = { id: 'rate-limit-headers', category: 'capabilities' as const, title: 'Rate limit response headers', spec: { url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/', asOf: '2026-10-22' } };
    const spec = await getOpenApi(target, http);
    let url = target.origin.toString();
    if (spec) {
      const probe = firstGetPath(spec);
      if (probe) url = probe.url(target);
    }
    const res = await fetchText(url, http);
    const names = [...res.headers.keys()].filter((h) => /ratelimit|x-rate|retry-after/i.test(h));
    const evidence = getEvidence('GET', url, res, names.length ? `headers: ${names.join(', ')}` : undefined);
    if (names.length) return makeResult(m, 'pass', `Rate-limit headers present: ${names.join(', ')}`, evidence);
    return makeResult(m, 'warn', 'No RateLimit/Retry-After headers on API responses', evidence);
  },
};

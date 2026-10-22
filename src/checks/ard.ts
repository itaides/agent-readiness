import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { decodeBody, fetchJsonWellKnown, fetchText, isRecord, makeResult, memoize } from './_shared';

const SPEC = { url: 'https://agenticresourcediscovery.org/', asOf: '2026-10-22' };
const AI_CATALOG_SPEC = { url: 'https://ai-catalog.io/', asOf: '2026-10-22' };

interface CatalogHit {
  url: string;
  data: unknown;
  via: string;
  legacy: boolean;
  evidence: Evidence;
}

export function parseLinkHeader(header: string): { rel: string; href: string; type?: string }[] {
  const out: { rel: string; href: string; type?: string }[] = [];
  for (const part of header.split(',')) {
    const m = /^\s*<([^>]+)>\s*;(.*)$/.exec(part);
    if (!m) continue;
    const params: Record<string, string> = {};
    for (const p of m[2].matchAll(/([a-zA-Z-]+)\s*=\s*"?([^";]+)"?/g)) params[p[1].toLowerCase()] = p[2];
    const rel = params.rel ?? '';
    if (rel) for (const r of rel.split(/\s+/)) out.push({ rel: r.toLowerCase(), href: m[1], type: params.type });
  }
  return out;
}

async function fetchJsonUrl(url: string, http: HttpClient): Promise<{ data: unknown; evidence: Evidence } | null> {
  const res = await fetchText(url, http);
  const evidence: Evidence = {
    request: { method: 'GET', url },
    response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: res.text.slice(0, 256), finalUrl: res.finalUrl },
  };
  if (res.status !== 200 || !/json/i.test(res.contentType)) return null;
  try { return { data: JSON.parse(res.text), evidence }; } catch { return null; }
}

async function discover(target: Target, http: HttpClient): Promise<CatalogHit | null> {
  const ardUrl = new URL('/.well-known/ard.json', target.origin).toString();
  const direct = await fetchJsonWellKnown(target.origin, '/.well-known/ard.json', http);
  if (direct.ok) return { url: ardUrl, data: direct.data, via: '/.well-known/ard.json', legacy: false, evidence: direct.evidence };

  const home = await fetchText(target.origin.toString(), http);
  const homeEvidence: Evidence = {
    request: { method: 'GET', url: target.origin.toString() },
    response: { status: home.status, contentType: home.contentType, bytes: home.body.length },
  };
  const rels = parseLinkHeader(home.headers.get('link') ?? '');
  for (const relName of ['ard', 'ai-catalog']) {
    const link = rels.find((r) => r.rel === relName);
    if (link) {
      const u = new URL(link.href, target.origin).toString();
      const hit = await fetchJsonUrl(u, http);
      if (hit) return { url: u, data: hit.data, via: `Link rel="${relName}"`, legacy: relName === 'ai-catalog', evidence: hit.evidence };
      return null;
    }
  }

  const legacy = await fetchJsonWellKnown(target.origin, '/.well-known/ai-catalog.json', http);
  if (legacy.ok) {
    return { url: new URL('/.well-known/ai-catalog.json', target.origin).toString(), data: legacy.data, via: '/.well-known/ai-catalog.json (legacy)', legacy: true, evidence: legacy.evidence };
  }
  void homeEvidence;
  return null;
}

function getCatalog(target: Target, http: HttpClient): Promise<CatalogHit | null> {
  return memoize(`ard:${target.origin}`, () => discover(target, http));
}

function catalogEntries(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data)) return [];
  const entries = data.entries ?? data.resources ?? data.catalog;
  if (Array.isArray(entries)) return entries.filter(isRecord);
  return [];
}

export const ardCatalog: Check = {
  id: 'ard-catalog',
  category: 'discoverability',
  title: 'ARD / AI catalog discovery',
  spec: SPEC,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'ard-catalog', category: 'discoverability' as const, title: 'ARD / AI catalog discovery', spec: SPEC };
    const hit = await getCatalog(target, http);
    if (!hit) {
      const res = await fetchJsonWellKnown(target.origin, '/.well-known/ard.json', http);
      return makeResult(meta, 'fail', res.ok ? 'unreachable' : `No ARD catalog found (${res.reason})`, res.evidence);
    }
    const note = hit.legacy ? ' via legacy path — migrate to /.well-known/ard.json (ARD v0.91)' : '';
    return makeResult(meta, 'pass', `Catalog discovered at ${hit.via}${note}`, hit.evidence);
  },
};

export const ardEntriesValid: Check = {
  id: 'ard-entries-valid',
  category: 'discoverability',
  title: 'ARD catalog entry validity',
  spec: AI_CATALOG_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'ard-entries-valid', category: 'discoverability' as const, title: 'ARD catalog entry validity', spec: AI_CATALOG_SPEC };
    const hit = await getCatalog(target, http);
    if (!hit) return makeResult(meta, 'skip', 'No catalog to validate', {});
    const entries = catalogEntries(hit.data);
    if (entries.length === 0) return makeResult(meta, 'warn', 'Catalog found but contains no entries array', hit.evidence);
    const problems: string[] = [];
    entries.forEach((e, i) => {
      const id = e.identifier ?? e.id ?? e.urn;
      if (typeof id !== 'string' || !/^urn:air:/i.test(id)) problems.push(`entry[${i}] missing urn:air identifier`);
      if (typeof (e.displayName ?? e.name) !== 'string' || !(e.displayName ?? e.name)) problems.push(`entry[${i}] missing displayName`);
      if (typeof (e.mediaType ?? e.media_type ?? e.type) !== 'string') problems.push(`entry[${i}] missing media type`);
      const hasUrl = typeof e.url === 'string';
      const hasData = e.data !== undefined;
      if (hasUrl === hasData) problems.push(`entry[${i}] must have exactly one of url or data`);
    });
    hit.evidence.note = `${entries.length} entries, ${problems.length} problems`;
    if (problems.length) return makeResult(meta, 'warn', problems.slice(0, 4).join('; '), hit.evidence);
    return makeResult(meta, 'pass', `All ${entries.length} catalog entries are complete (urn:air id, name, media type, one target)`, hit.evidence);
  },
};

export const ardTrustManifest: Check = {
  id: 'ard-trust-manifest',
  category: 'discoverability',
  title: 'ARD trust manifest',
  spec: AI_CATALOG_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'ard-trust-manifest', category: 'discoverability' as const, title: 'ARD trust manifest', spec: AI_CATALOG_SPEC };
    const hit = await getCatalog(target, http);
    if (!hit) return makeResult(meta, 'skip', 'No catalog to inspect', {});
    const entries = catalogEntries(hit.data);
    const hasTrust = isRecord(hit.data) && (hit.data.trustManifest || hit.data.trust_manifest || hit.data.signatures)
      || entries.some((e) => e.trustManifest || e.trust_manifest || e.signature);
    if (hasTrust) return makeResult(meta, 'pass', 'Catalog advertises trust signals (trustManifest / signatures)', hit.evidence);
    return makeResult(meta, 'warn', 'No trustManifest on catalog or entries — agents cannot verify resource provenance', hit.evidence);
  },
};

export const aiCatalogPublished: Check = {
  id: 'ai-catalog-published',
  category: 'discoverability',
  title: 'AI Catalog (ai-catalog.json) published',
  spec: AI_CATALOG_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'ai-catalog-published', category: 'discoverability' as const, title: 'AI Catalog (ai-catalog.json) published', spec: AI_CATALOG_SPEC };
    const res = await fetchJsonWellKnown(target.origin, '/.well-known/ai-catalog.json', http);
    if (!res.ok) {
      const ard = await fetchJsonWellKnown(target.origin, '/.well-known/ard.json', http);
      if (ard.ok) return makeResult(meta, 'skip', 'Canonical /.well-known/ard.json already published; ai-catalog.json alias optional', {});
      return makeResult(meta, 'warn', `No ai-catalog.json (${res.reason})`, res.evidence);
    }
    const spec = isRecord(res.data) ? res.data.specVersion ?? res.data.spec_version : undefined;
    if (spec === undefined) return makeResult(meta, 'warn', 'ai-catalog.json found but missing top-level specVersion', res.evidence);
    return makeResult(meta, 'pass', `Valid ai-catalog.json (specVersion ${String(spec)})`, res.evidence);
  },
};

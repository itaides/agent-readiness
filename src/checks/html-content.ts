import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchPage, makeResult, memoize } from './_shared';
import { jsonLdSameAs, jsonLdTypes, parseHtml, parseJsonLdBlocks } from './_html';

// Checks sharing the homepage fetch + parse.

function getPage(target: Target, http: HttpClient) {
  return memoize(`htmlpage:${target.contentUrl}`, async () => {
    const page = await fetchPage(target.contentUrl.toString(), http);
    const doc = parseHtml(page.body);
    const { parsed } = parseJsonLdBlocks(doc.jsonLdBlocks);
    return { doc, url: page.url, status: page.status, evidence: page.evidence, jsonLdDocs: parsed };
  });
}

const CONTENT_SPEC = { url: 'https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/', asOf: '2026-10-22' };
const SCHEMA_SPEC = { url: 'https://schema.org/', asOf: '2026-10-22' };
const OG_SPEC = { url: 'https://ogp.me/', asOf: '2026-10-22' };

export const contentNoJs: Check = {
  id: 'content-no-js',
  category: 'content',
  title: 'Content readable without JavaScript',
  spec: CONTENT_SPEC,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'content-no-js', category: 'content' as const, title: 'Content readable without JavaScript', spec: CONTENT_SPEC };
    const { doc, status, evidence } = await getPage(target, http);
    if (status !== 200) return makeResult(meta, 'warn', `Content URL returned HTTP ${status}`, evidence);
    const h1 = doc.headings.some((h) => h.level === 1);
    if (doc.textLength >= 500 && h1) {
      return makeResult(meta, 'pass', `${doc.textLength} chars of meaningful text + H1 in raw HTML`, evidence);
    }
    if (doc.textLength >= 500) return makeResult(meta, 'warn', `${doc.textLength} chars of text but no H1 heading`, evidence);
    return makeResult(meta, 'fail', `Only ${doc.textLength} chars of visible text — page likely requires JavaScript`, evidence);
  },
};

export const metadataCompleteness: Check = {
  id: 'metadata-completeness',
  category: 'content',
  title: 'Metadata completeness',
  spec: OG_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'metadata-completeness', category: 'content' as const, title: 'Metadata completeness', spec: OG_SPEC };
    const { doc, evidence } = await getPage(target, http);
    const metaNames = new Set(doc.metas.map((m) => m.name));
    const missing: string[] = [];
    if (!doc.title) missing.push('title');
    if (!metaNames.has('description')) missing.push('meta description');
    if (!doc.canonical) missing.push('canonical');
    if (!doc.lang) missing.push('html lang');
    if (!metaNames.has('og:image')) missing.push('og:image');
    if (!metaNames.has('og:type')) missing.push('og:type');
    if (missing.length === 0) return makeResult(meta, 'pass', 'Title, description, canonical, lang, og:image and og:type all present', evidence);
    if (missing.length <= 2) return makeResult(meta, 'warn', `Missing: ${missing.join(', ')}`, evidence);
    return makeResult(meta, 'warn', `Sparse metadata — missing: ${missing.join(', ')}`, evidence);
  },
};

export const jsonLd: Check = {
  id: 'json-ld',
  category: 'content',
  title: 'JSON-LD structured data',
  spec: SCHEMA_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'json-ld', category: 'content' as const, title: 'JSON-LD structured data', spec: SCHEMA_SPEC };
    const { doc, jsonLdDocs, evidence } = await getPage(target, http);
    const { invalid } = parseJsonLdBlocks(doc.jsonLdBlocks);
    if (doc.jsonLdBlocks.length === 0) return makeResult(meta, 'warn', 'No JSON-LD blocks found on the content page', evidence);
    if (invalid > 0) return makeResult(meta, 'warn', `${invalid} of ${doc.jsonLdBlocks.length} JSON-LD blocks fail to parse`, evidence);
    const types = jsonLdDocs.flatMap(jsonLdTypes);
    if (types.length === 0) return makeResult(meta, 'warn', 'JSON-LD parses but declares no @type', evidence);
    return makeResult(meta, 'pass', `JSON-LD with types: ${[...new Set(types)].slice(0, 6).join(', ')}`, evidence);
  },
};

export const jsonLdEntityLinking: Check = {
  id: 'json-ld-entity-linking',
  category: 'content',
  title: 'JSON-LD entity linking (sameAs)',
  spec: SCHEMA_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'json-ld-entity-linking', category: 'content' as const, title: 'JSON-LD entity linking (sameAs)', spec: SCHEMA_SPEC };
    const { jsonLdDocs, evidence } = await getPage(target, http);
    if (jsonLdDocs.length === 0) return makeResult(meta, 'skip', 'No JSON-LD to inspect', {});
    const sameAs = jsonLdDocs.flatMap(jsonLdSameAs);
    if (sameAs.length === 0) return makeResult(meta, 'warn', 'JSON-LD has no sameAs links to official profiles', evidence);
    return makeResult(meta, 'pass', `${sameAs.length} sameAs link(s): ${sameAs.slice(0, 3).join(', ')}`, evidence);
  },
};

export const orgSchemaCompleteness: Check = {
  id: 'org-schema-completeness',
  category: 'content',
  title: 'Organization schema completeness',
  spec: SCHEMA_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'org-schema-completeness', category: 'content' as const, title: 'Organization schema completeness', spec: SCHEMA_SPEC };
    const { jsonLdDocs, evidence } = await getPage(target, http);
    const findOrg = (v: unknown): Record<string, unknown> | null => {
      if (Array.isArray(v)) { for (const x of v) { const r = findOrg(x); if (r) return r; } return null; }
      if (typeof v !== 'object' || v === null) return null;
      const rec = v as Record<string, unknown>;
      const t = rec['@type'];
      if (t === 'Organization' || t === 'Corporation' || (Array.isArray(t) && t.includes('Organization'))) return rec;
      for (const val of Object.values(rec)) { const r = findOrg(val); if (r) return r; }
      return null;
    };
    const org = jsonLdDocs.map(findOrg).find(Boolean);
    if (!org) return makeResult(meta, 'warn', 'No Organization type in JSON-LD', evidence);
    const missing: string[] = [];
    if (!org.name) missing.push('name');
    if (!org.url) missing.push('url');
    if (!org.logo) missing.push('logo');
    if (!org.contactPoint && !org.address) missing.push('contactPoint/address');
    if (missing.length) return makeResult(meta, 'warn', `Organization schema missing: ${missing.join(', ')}`, evidence);
    return makeResult(meta, 'pass', 'Organization schema includes name, url, logo and contact details', evidence);
  },
};

export const schemaTypeBreadth: Check = {
  id: 'schema-type-breadth',
  category: 'content',
  title: 'Schema type breadth',
  spec: SCHEMA_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'schema-type-breadth', category: 'content' as const, title: 'Schema type breadth', spec: SCHEMA_SPEC };
    const { jsonLdDocs, evidence } = await getPage(target, http);
    const types = [...new Set(jsonLdDocs.flatMap(jsonLdTypes))];
    if (types.length >= 2) return makeResult(meta, 'pass', `${types.length} schema types: ${types.slice(0, 8).join(', ')}`, evidence);
    if (types.length === 1) return makeResult(meta, 'warn', `Only one schema type (${types[0]}) — FAQs, products and articles broaden what AIs can answer`, evidence);
    return makeResult(meta, 'warn', 'No schema.org types declared', evidence);
  },
};

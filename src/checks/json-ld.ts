import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { extractJsonLd, fetchContentPage } from './_page';

const META = {
  id: 'json-ld',
  category: 'content' as const,
  title: 'JSON-LD structured data',
  spec: { url: 'https://schema.org/', asOf: '2026-10-13' },
};

function hasType(node: unknown, depth = 0): boolean {
  if (depth > 4 || node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasType(n, depth + 1));
  const obj = node as Record<string, unknown>;
  if (typeof obj['@type'] === 'string' || Array.isArray(obj['@type'])) return true;
  return Object.values(obj).some((v) => hasType(v, depth + 1));
}

const jsonLd: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;

    if (page.status !== 200) return makeResult(META, 'fail', `HTTP ${page.status}`, evidence);
    if (page.contentType && !/text\/html/i.test(page.contentType)) {
      return makeResult(META, 'fail', `content-type "${page.contentType}" is not text/html`, evidence);
    }

    const { parsed, rawBlocks, parseErrors } = extractJsonLd(page.bodyText);
    if (parsed.length > 0 && parsed.some((b) => hasType(b))) {
      const types = parsed.flatMap((b) => {
        const t = (b as Record<string, unknown>)?.['@type'];
        return Array.isArray(t) ? t : t ? [t] : [];
      });
      return makeResult(META, 'pass', `${parsed.length} JSON-LD block(s), @type: ${[...new Set(types)].slice(0, 4).join(', ') || 'present'}`, evidence);
    }
    if (rawBlocks > 0 || parseErrors > 0) {
      return makeResult(META, 'fail', `${rawBlocks} ld+json block(s) found but none parse as JSON with @type`, evidence);
    }
    if (/\bitemscope\b|\bitemtype\s*=/i.test(page.bodyText) || /\b(vocab|typeof)\s*=\s*["']/i.test(page.bodyText)) {
      return makeResult(META, 'warn', 'No JSON-LD — only microdata/RDFa detected; convert to JSON-LD for cleaner agent parsing', evidence);
    }
    return makeResult(META, 'fail', 'No application/ld+json structured data on the page', evidence);
  },
};

export default jsonLd;

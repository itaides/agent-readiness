// Minimal regex-based HTML extraction. Not a full parser — just enough for
// deterministic checks on publicly served markup.

export interface AnchorTag { href: string; text: string }
export interface LinkTag { rel: string; href: string; type?: string }
export interface MetaTag { name: string; content: string }
export interface InputTag { tag: string; type: string; name?: string; labeled: boolean }
export interface ClickableTag { tag: string; named: boolean; roleButton: boolean }

export interface ParsedHtml {
  title?: string;
  lang?: string;
  canonical?: string;
  metas: MetaTag[];
  links: LinkTag[];
  anchors: AnchorTag[];
  jsonLdBlocks: string[];
  headings: { level: number; text: string }[];
  textLength: number;
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  hasNoscript: boolean;
  forms: { inputs: InputTag[] }[];
  clickables: ClickableTag[];
  imagesMissingAlt: number;
  hiddenText: string[];
  ariaTexts: string[];
  metaRefresh: boolean;
  jsOnlyRedirect: boolean;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseHtml(html: string): ParsedHtml {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const lang = /<html[^>]*\slang\s*=\s*["']?([a-zA-Z-]+)/i.exec(html)?.[1];
  const canonical = /<link[^>]*rel\s*=\s*["']?canonical["']?[^>]*>/i.exec(html);
  const canonicalHref = canonical ? attrs(canonical[0]).href : undefined;

  const metas: MetaTag[] = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = a.name ?? a.property ?? a['http-equiv'] ?? '';
    if (key && a.content !== undefined) metas.push({ name: key.toLowerCase(), content: a.content });
  }

  const links: LinkTag[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.rel && a.href) links.push({ rel: a.rel.toLowerCase(), href: a.href, type: a.type });
  }

  const anchors: AnchorTag[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    anchors.push({ href: m[1], text: stripTags(m[2]).slice(0, 120) });
  }

  const jsonLdBlocks: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdBlocks.push(m[1].trim());
  }

  const headings: { level: number; text: string }[] = [];
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: Number(m[1]), text: stripTags(m[2]).slice(0, 160) });
  }

  const forms: { inputs: InputTag[] }[] = [];
  for (const fm of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
    const inner = fm[1];
    const inputs: InputTag[] = [];
    const labelFors = new Set([...inner.matchAll(/<label\b[^>]*for\s*=\s*["']([^"']+)["']/gi)].map((l) => l[1]));
    for (const im of inner.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
      const a = attrs(im[0]);
      const type = (a.type ?? 'text').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button') continue;
      const labeled = Boolean(a['aria-label'] || a['aria-labelledby'] || (a.id && labelFors.has(a.id)) || a.title);
      inputs.push({ tag: im[1].toLowerCase(), type, name: a.name, labeled });
    }
    forms.push({ inputs });
  }

  const clickables: ClickableTag[] = [];
  for (const m of html.matchAll(/<(button|summary)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const a = attrs('<' + m[2] + '>');
    const named = Boolean(stripTags(m[3]) || a['aria-label'] || a['aria-labelledby'] || a.title);
    clickables.push({ tag: m[1].toLowerCase(), named, roleButton: false });
  }
  for (const m of html.matchAll(/<(div|span|li)\b([^>]*(?:onclick|role\s*=\s*["']button["'])[^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const a = attrs('<' + m[2] + '>');
    const named = Boolean(stripTags(m[3]) || a['aria-label'] || a['aria-labelledby'] || a.title);
    clickables.push({ tag: m[1].toLowerCase(), named, roleButton: true });
  }
  for (const m of html.matchAll(/<input\b[^>]*type\s*=\s*["']?(button|submit|image)["']?[^>]*>/gi)) {
    const a = attrs(m[0]);
    clickables.push({ tag: 'input', named: Boolean(a.value || a['aria-label'] || a.alt), roleButton: false });
  }

  let imagesMissingAlt = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.alt === undefined) imagesMissingAlt++;
  }

  const hiddenText: string[] = [];
  for (const m of html.matchAll(/<([a-z0-9]+)\b[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden|aria-hidden\s*=\s*["']?true|hidden\b)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = stripTags(m[2]);
    if (t.length > 40) hiddenText.push(t.slice(0, 400));
  }

  const ariaTexts: string[] = [];
  for (const m of html.matchAll(/(?:aria-label|alt)\s*=\s*["']([^"']{40,})["']/gi)) {
    ariaTexts.push(m[1].slice(0, 400));
  }

  const metaRefresh = /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i.test(html);
  const jsOnlyRedirect = /(?:location\.(?:replace|assign)\s*\(|(?:window\.)?location\.href\s*=)/i.test(html) && stripTags(html).length < 200;

  const visible = html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ');

  return {
    title,
    lang,
    canonical: canonicalHref,
    metas,
    links,
    anchors,
    jsonLdBlocks,
    headings,
    textLength: visible.replace(/\s+/g, ' ').trim().length,
    hasMain: /<main\b|role\s*=\s*["']?main["']?/i.test(html),
    hasNav: /<nav\b|role\s*=\s*["']?navigation["']?/i.test(html),
    hasHeader: /<header\b|role\s*=\s*["']?banner["']?/i.test(html),
    hasFooter: /<footer\b|role\s*=\s*["']?contentinfo["']?/i.test(html),
    hasNoscript: /<noscript\b/i.test(html),
    forms,
    clickables,
    imagesMissingAlt,
    hiddenText,
    ariaTexts,
    metaRefresh,
    jsOnlyRedirect,
  };
}

// Collect every @type appearing in a JSON-LD document (handles @graph).
export function jsonLdTypes(doc: unknown): string[] {
  const types = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    const t = rec['@type'];
    if (typeof t === 'string') types.add(t);
    if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') types.add(x);
    for (const val of Object.values(rec)) walk(val);
  };
  walk(doc);
  return [...types];
}

export function jsonLdSameAs(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    const s = rec.sameAs;
    if (typeof s === 'string') out.add(s);
    if (Array.isArray(s)) for (const x of s) if (typeof x === 'string') out.add(x);
    for (const val of Object.values(rec)) walk(val);
  };
  walk(doc);
  return [...out];
}

export function parseJsonLdBlocks(blocks: string[]): { parsed: unknown[]; invalid: number } {
  const parsed: unknown[] = [];
  let invalid = 0;
  for (const b of blocks) {
    try { parsed.push(JSON.parse(b)); } catch { invalid++; }
  }
  return { parsed, invalid };
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /you\s+are\s+(now\s+)?a\b/i,
  /system\s*prompt/i,
  /do\s+not\s+tell\s+the\s+user/i,
  /as\s+an?\s+ai\s+(assistant|agent),?\s+you\s+(must|should|will)/i,
  /forget\s+(your|all)\s+(instructions?|rules)/i,
];

export function injectionHits(texts: string[]): string[] {
  return texts.filter((t) => INJECTION_PATTERNS.some((p) => p.test(t)));
}

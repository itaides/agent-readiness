import type { Evidence, HttpClient, Target } from '../types';
import { decodeBody } from './_shared';

export interface FetchedPage {
  url: string;
  status: number;
  headers: Headers;
  contentType: string;
  bodyText: string;
  finalUrl: string;
  redirectChain: string[];
  evidence: Evidence;
}

// Content-page fetches are shared across page-scoped checks so a default scan
// costs one GET for the page no matter how many checks read it.
const cache = new WeakMap<HttpClient, Map<string, Promise<FetchedPage>>>();

export function fetchPage(http: HttpClient, url: string, headers?: Record<string, string>): Promise<FetchedPage> {
  let perClient = cache.get(http);
  if (!perClient) {
    perClient = new Map();
    cache.set(http, perClient);
  }
  const key = headers ? `${url}\n${JSON.stringify(headers)}` : url;
  const cached = perClient.get(key);
  if (cached) return cached;
  const promise = doFetch(http, url, headers);
  perClient.set(key, promise);
  return promise;
}

async function doFetch(http: HttpClient, url: string, headers?: Record<string, string>): Promise<FetchedPage> {
  const res = await http.fetch(url, headers ? { headers } : undefined);
  const bodyText = decodeBody(res.body);
  return {
    url,
    status: res.status,
    headers: res.headers,
    contentType: res.contentType,
    bodyText,
    finalUrl: res.finalUrl,
    redirectChain: res.redirectChain,
    evidence: {
      request: { method: 'GET', url, headers },
      response: {
        status: res.status,
        contentType: res.contentType,
        bytes: res.body.length,
        preview: bodyText.slice(0, 256),
        finalUrl: res.finalUrl,
        redirectChain: res.redirectChain.length ? res.redirectChain : undefined,
      },
    },
  };
}

export function fetchContentPage(target: Target, http: HttpClient): Promise<FetchedPage> {
  return fetchPage(http, target.contentUrl.toString());
}

/** Visible text ratio: strips script/style/noscript blocks and tags, then compares text bytes to document bytes. */
export function textToHtmlRatio(html: string): number {
  if (html.length === 0) return 0;
  const stripped = html
    .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length / html.length;
}

export function extractJsonLd(html: string): { parsed: unknown[]; rawBlocks: number; parseErrors: number } {
  const parsed: unknown[] = [];
  let parseErrors = 0;
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '').trim();
    if (!inner) continue;
    try {
      parsed.push(JSON.parse(inner));
    } catch {
      parseErrors++;
    }
  }
  return { parsed, rawBlocks: blocks.length, parseErrors };
}

export function htmlLinkHrefs(html: string, rel: string, type?: string): string[] {
  const hrefs: string[] = [];
  const linkRe = /<link\b[^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
    if (!relMatch || !relMatch[1].toLowerCase().split(/\s+/).includes(rel.toLowerCase())) continue;
    if (type) {
      const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
      if (!typeMatch || !typeMatch[1].toLowerCase().includes(type.toLowerCase())) continue;
    }
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) hrefs.push(hrefMatch[1]);
  }
  return hrefs;
}

export function parseLinkHeader(header: string | null): Array<{ url: string; params: Record<string, string> }> {
  if (!header) return [];
  const out: Array<{ url: string; params: Record<string, string> }> = [];
  for (const part of header.split(/,(?=\s*<)/)) {
    const m = part.match(/<([^>]+)>\s*(;.*)?/);
    if (!m) continue;
    const params: Record<string, string> = {};
    for (const p of (m[2] ?? '').matchAll(/;\s*([^=\s]+)\s*=\s*"?([^";]+)"?/g)) {
      params[p[1].toLowerCase()] = p[2];
    }
    out.push({ url: m[1], params });
  }
  return out;
}

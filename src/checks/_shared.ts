import type { CheckResult, Evidence, HttpClient, Status } from '../types';

export interface CheckMeta {
  id: string;
  category: CheckResult['category'];
  title: string;
  spec: { url: string; asOf: string };
}

export function makeResult(meta: CheckMeta, status: Status, message: string, evidence: Evidence): CheckResult {
  return {
    id: meta.id,
    category: meta.category,
    title: meta.title,
    spec: meta.spec,
    status,
    message,
    evidence,
    remediationPromptPath: status === 'fail' ? `prompts/${meta.id}.md` : undefined,
  };
}

export type JsonFetchResult =
  | { ok: true; data: unknown; evidence: Evidence }
  | { ok: false; reason: string; evidence: Evidence };

export async function fetchJsonWellKnown(
  origin: URL,
  path: string,
  http: HttpClient,
): Promise<JsonFetchResult> {
  const url = new URL(path, origin).toString();
  const res = await http.fetch(url);
  const bodyText = new TextDecoder('utf-8').decode(res.body);
  const evidence: Evidence = {
    request: { method: 'GET', url },
    response: {
      status: res.status,
      contentType: res.contentType,
      bytes: res.body.length,
      preview: bodyText.slice(0, 256),
      finalUrl: res.finalUrl,
      redirectChain: res.redirectChain.length ? res.redirectChain : undefined,
    },
  };
  if (res.status !== 200) return { ok: false, reason: `Not found (HTTP ${res.status})`, evidence };
  if (!/json/i.test(res.contentType)) {
    return { ok: false, reason: `200 but content-type "${res.contentType}" — likely SPA fallthrough, not real JSON`, evidence };
  }
  try {
    return { ok: true, data: JSON.parse(bodyText), evidence };
  } catch {
    return { ok: false, reason: '200 with JSON content-type but body is not valid JSON', evidence };
  }
}

export function decodeBody(body: Uint8Array): string {
  return new TextDecoder('utf-8').decode(body);
}

// ---------------------------------------------------------------------------
// Memoization: checks in one scan share an HttpClient, so helpers cache
// fetched documents per URL to avoid duplicate requests across check families.

const memo = new Map<string, Promise<unknown>>();

export function memoize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn().catch((err) => {
    memo.delete(key);
    throw err;
  });
  memo.set(key, p);
  return p;
}

export function clearMemo(): void {
  memo.clear();
}

export interface Fetched {
  status: number;
  text: string;
  contentType: string;
  finalUrl: string;
  redirectChain: string[];
  headers: Headers;
  body: Uint8Array;
}

export async function fetchText(
  url: string,
  http: HttpClient,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<Fetched> {
  const res = await http.fetch(url, init);
  return {
    status: res.status,
    text: decodeBody(res.body),
    contentType: res.contentType,
    finalUrl: res.finalUrl,
    redirectChain: res.redirectChain,
    headers: res.headers,
    body: res.body,
  };
}

export function getEvidence(method: string, url: string, res: Fetched, note?: string, reqHeaders?: Record<string, string>): Evidence {
  return {
    request: { method, url, headers: reqHeaders },
    response: {
      status: res.status,
      contentType: res.contentType,
      bytes: res.body.length,
      preview: res.text.slice(0, 256),
      finalUrl: res.finalUrl,
      redirectChain: res.redirectChain.length ? res.redirectChain : undefined,
    },
    note,
  };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Fetch robots.txt once per origin; shared by the policy checks.
export interface RobotsDoc {
  status: number;
  body: string;
  url: string;
  evidence: Evidence;
}

export function fetchRobots(origin: URL, http: HttpClient): Promise<RobotsDoc> {
  const url = new URL('/robots.txt', origin).toString();
  return memoize(`robots:${url}`, async () => {
    const res = await fetchText(url, http);
    return { status: res.status, body: res.text, url, evidence: getEvidence('GET', url, res) };
  });
}

// Fetch the scan's content page once; shared by HTML/content checks.
export interface PageDoc {
  status: number;
  body: string;
  url: string;
  contentType: string;
  headers: Headers;
  evidence: Evidence;
}

export function fetchPage(url: string, http: HttpClient, headers?: Record<string, string>): Promise<PageDoc> {
  const key = `page:${url}:${JSON.stringify(headers ?? {})}`;
  return memoize(key, async () => {
    const res = await fetchText(url, http, { headers });
    return { status: res.status, body: res.text, url, contentType: res.contentType, headers: res.headers, evidence: getEvidence('GET', url, res, undefined, headers) };
  });
}

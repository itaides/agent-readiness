import type { HttpClient, HttpResponse } from './types';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export interface HttpClientOptions {
  timeoutMs: number;
  userAgent: string;
  defaultHeaders: Record<string, string>;
  insecure: boolean;
  maxBodyBytes?: number;
  maxRedirects?: number;
}

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const maxBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  if (opts.insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  async function singleFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      return await fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async fetch(url, init = {}): Promise<HttpResponse> {
      const method = init.method ?? 'GET';
      const headers: Record<string, string> = {
        'User-Agent': opts.userAgent,
        ...opts.defaultHeaders,
        ...(init.headers ?? {}),
      };

      const redirectChain: string[] = [];
      let currentUrl = url;
      let res: Response | null = null;

      for (let i = 0; i <= maxRedirects; i++) {
        res = await singleFetch(currentUrl, { method, headers, body: init.body });
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          if (i === maxRedirects) break;
          redirectChain.push(currentUrl);
          currentUrl = new URL(loc, currentUrl).toString();
          continue;
        }
        break;
      }
      if (!res) throw new Error('no response received');

      const body = await readWithCap(res, maxBytes);
      return {
        status: res.status,
        headers: res.headers,
        body,
        contentType: res.headers.get('content-type') ?? '',
        finalUrl: currentUrl,
        redirectChain,
      };
    },
  };
}

async function readWithCap(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.length > maxBytes) {
      const remain = maxBytes - total;
      if (remain > 0) chunks.push(value.subarray(0, remain));
      total = maxBytes;
      try { await reader.cancel(); } catch { /* stream already closed */ }
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

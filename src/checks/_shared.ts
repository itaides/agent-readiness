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

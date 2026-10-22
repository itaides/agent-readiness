import type { HttpClient } from '../types';
import { decodeBody, memoize } from './_shared';

// Minimal MCP Streamable-HTTP client shared by the deep MCP checks so a scan
// performs one initialize handshake per endpoint.

export interface McpRpcResult {
  ok: boolean;
  status: number;
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
  sessionId?: string;
  protocolVersion?: string;
}

export interface McpSession {
  url: string;
  serverInfo?: { name?: string; version?: string };
  capabilities?: Record<string, unknown>;
  instructions?: string;
  protocolVersion?: string;
  sessionId?: string;
  transport: 'streamable-http' | 'legacy-sse' | 'unknown';
  initStatus: number;
  initOk: boolean;
  call(method: string, params?: Record<string, unknown>): Promise<McpRpcResult>;
  getTools(): Promise<Record<string, unknown>[]>;
  getResources(): Promise<Record<string, unknown>[]>;
}

const PROTO_VERSIONS = ['2026-07-28', '2025-06-18', '2025-03-26', '2024-11-05'];

function parseSse(body: string): unknown | null {
  const datas = body.split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter((l) => l && l !== '[DONE]');
  for (let i = datas.length - 1; i >= 0; i--) {
    try { return JSON.parse(datas[i]); } catch { /* keep looking */ }
  }
  return null;
}

function parseRpcBody(body: string, contentType: string): Record<string, unknown> | null {
  try {
    const data = /text\/event-stream/i.test(contentType) ? parseSse(body) : JSON.parse(body);
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function rpc(http: HttpClient, url: string, method: string, params: Record<string, unknown> | undefined, sessionId: string | undefined, protocolVersion: string | undefined): Promise<McpRpcResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const payload = JSON.stringify({ jsonrpc: '2.0', id: `ar-${Math.random().toString(36).slice(2, 8)}`, method, params });
  const res = await http.fetch(url, { method: 'POST', headers, body: payload });
  const text = decodeBody(res.body);
  const parsed = parseRpcBody(text, res.contentType);
  const sid = res.headers.get('mcp-session-id') ?? undefined;
  if (res.status === 202 && !parsed) return { ok: true, status: res.status, sessionId: sid, protocolVersion };
  if (!parsed) return { ok: false, status: res.status, sessionId: sid, protocolVersion };
  const err = parsed.error as { code?: number; message?: string } | undefined;
  return {
    ok: !err && res.status === 200,
    status: res.status,
    result: parsed.result as Record<string, unknown> | undefined,
    error: err,
    sessionId: sid,
    protocolVersion,
  };
}

async function init(url: string, http: HttpClient): Promise<McpSession> {
  let initRes: McpRpcResult | null = null;
  let usedVersion: string | undefined;
  for (const v of PROTO_VERSIONS) {
    initRes = await rpc(http, url, 'initialize', {
      protocolVersion: v,
      capabilities: {},
      clientInfo: { name: 'agent-readiness', version: '0.0.1' },
    }, undefined, undefined);
    if (initRes.result || (initRes.error && initRes.error.code !== -32603)) { usedVersion = v; break; }
    if (initRes.status === 401 || initRes.status === 403) { usedVersion = v; break; }
  }

  const sessionId = initRes?.sessionId;
  const result = initRes?.result;
  const negotiated = (result?.protocolVersion as string | undefined) ?? usedVersion;

  // notify initialized (best-effort)
  if (initRes?.ok) {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    };
    if (negotiated) headers['MCP-Protocol-Version'] = negotiated;
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    try {
      await http.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
    } catch { /* best-effort */ }
  }

  const toolsCache = new Map<string, Promise<McpRpcResult>>();
  const call = (method: string, params?: Record<string, unknown>): Promise<McpRpcResult> => {
    const key = `${method}:${JSON.stringify(params ?? {})}`;
    const hit = toolsCache.get(key);
    if (hit) return hit;
    const p = rpc(http, url, method, params, sessionId, negotiated).catch((e) => {
      toolsCache.delete(key);
      throw e;
    });
    toolsCache.set(key, p);
    return p;
  };

  const serverInfo = result?.serverInfo as { name?: string; version?: string } | undefined;

  return {
    url,
    serverInfo,
    capabilities: result?.capabilities as Record<string, unknown> | undefined,
    instructions: result?.instructions as string | undefined,
    protocolVersion: negotiated,
    sessionId,
    transport: initRes && initRes.status !== 0 ? 'streamable-http' : 'unknown',
    initStatus: initRes?.status ?? 0,
    initOk: Boolean(initRes?.result),
    call,
    async getTools() {
      const r = await call('tools/list');
      const tools = r.result?.tools;
      return Array.isArray(tools) ? tools.filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null) : [];
    },
    async getResources() {
      const r = await call('resources/list');
      const res = r.result?.resources;
      return Array.isArray(res) ? res.filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null) : [];
    },
  };
}

export function getMcpSession(url: URL, http: HttpClient): Promise<McpSession> {
  return memoize(`mcp:${url}`, () => init(url.toString(), http));
}

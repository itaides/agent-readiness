import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchJsonWellKnown, fetchText, isRecord, makeResult } from './_shared';
import { getMcpSession, type McpSession } from './_mcp';

const SPEC = { url: 'https://modelcontextprotocol.io/specification', asOf: '2026-10-22' };

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

async function sessionOrSkip(mcpUrl: URL | undefined, http: HttpClient, m: ReturnType<typeof meta>): Promise<{ session: McpSession } | { result: CheckResult }> {
  if (!mcpUrl) return { result: makeResult(m, 'skip', 'Provide --mcp-url to run MCP checks', {}) };
  const session = await getMcpSession(mcpUrl, http);
  return { session };
}

function make(id: string, title: string, fn: (s: McpSession, target: Target, http: HttpClient) => Promise<CheckResult> | CheckResult): Check {
  const m = meta(id, title);
  return {
    ...m,
    defaultEnabled: false,
    scored: false,
    async run(target: Target, http: HttpClient, options): Promise<CheckResult> {
      const got = await sessionOrSkip(options?.mcpUrl, http, m);
      if ('result' in got) return got.result;
      return fn(got.session, target, http);
    },
  };
}

const evidenceOf = (s: McpSession) => ({
  request: { method: 'POST', url: s.url },
  note: `transport=${s.transport}; protocol=${s.protocolVersion ?? 'unknown'}`,
});

export const mcpServer = make('mcp-server', 'MCP server reachable (initialize)', (s) => {
  const m = meta('mcp-server', 'MCP server reachable (initialize)');
  if (s.initOk) return makeResult(m, 'pass', `initialize succeeded${s.serverInfo?.name ? ` — ${s.serverInfo.name}` : ''}`, evidenceOf(s));
  if (s.initStatus === 401 || s.initStatus === 403) return makeResult(m, 'pass', `Server requires auth (HTTP ${s.initStatus}) — reachability confirmed`, evidenceOf(s));
  return makeResult(m, 'warn', `initialize failed (HTTP ${s.initStatus})`, evidenceOf(s));
});

export const mcpServerIdentity = make('mcp-server-identity', 'MCP server identity', (s) => {
  const m = meta('mcp-server-identity', 'MCP server identity');
  if (!s.initOk) return makeResult(m, 'skip', 'initialize did not complete', {});
  const missing: string[] = [];
  if (!s.serverInfo?.name) missing.push('name');
  if (!s.serverInfo?.version) missing.push('version');
  if (missing.length === 0 && s.instructions) {
    return makeResult(m, 'pass', `${s.serverInfo!.name} v${s.serverInfo!.version} with instructions`, evidenceOf(s));
  }
  if (missing.length === 0) return makeResult(m, 'warn', 'serverInfo complete but no usage instructions', evidenceOf(s));
  return makeResult(m, 'warn', `serverInfo missing: ${missing.join(', ')}`, evidenceOf(s));
});

export const mcpToolListing = make('mcp-tool-listing', 'MCP tool listing', async (s) => {
  const m = meta('mcp-tool-listing', 'MCP tool listing');
  const r = await s.call('tools/list');
  if (!r.ok && r.error) return makeResult(m, 'warn', `tools/list returned JSON-RPC error ${r.error.code}`, evidenceOf(s));
  const tools = await s.getTools();
  if (tools.length === 0) return makeResult(m, 'warn', 'tools/list returned zero tools', evidenceOf(s));
  return makeResult(m, 'pass', `${tools.length} tools listed`, evidenceOf(s));
});

export const mcpToolDescriptions = make('mcp-tool-descriptions', 'MCP tool descriptions', async (s) => {
  const m = meta('mcp-tool-descriptions', 'MCP tool descriptions');
  const tools = await s.getTools();
  if (tools.length === 0) return makeResult(m, 'skip', 'No tools to grade', {});
  const thin = tools.filter((t) => typeof t.description !== 'string' || (t.description as string).trim().length < 15);
  if (thin.length === 0) return makeResult(m, 'pass', `All ${tools.length} tools have substantive descriptions`, evidenceOf(s));
  return makeResult(m, 'warn', `${thin.length}/${tools.length} tools lack useful descriptions (${thin.slice(0, 3).map((t) => t.name).join(', ')})`, evidenceOf(s));
});

export const mcpParamSchemas = make('mcp-param-schemas', 'MCP parameter schemas', async (s) => {
  const m = meta('mcp-param-schemas', 'MCP parameter schemas');
  const tools = await s.getTools();
  if (tools.length === 0) return makeResult(m, 'skip', 'No tools to grade', {});
  const untyped = tools.filter((t) => {
    const schema = t.inputSchema;
    if (!isRecord(schema)) return true;
    if (schema.type === 'object' && isRecord(schema.properties)) return false;
    return true;
  });
  if (untyped.length === 0) return makeResult(m, 'pass', `All ${tools.length} tools declare typed object input schemas`, evidenceOf(s));
  return makeResult(m, 'warn', `${untyped.length}/${tools.length} tools lack typed inputSchema (${untyped.slice(0, 3).map((t) => t.name).join(', ')})`, evidenceOf(s));
});

export const mcpToolNaming = make('mcp-tool-naming', 'MCP tool naming', async (s) => {
  const m = meta('mcp-tool-naming', 'MCP tool naming');
  const tools = await s.getTools();
  if (tools.length === 0) return makeResult(m, 'skip', 'No tools to grade', {});
  const bad = tools.filter((t) => typeof t.name !== 'string' || !/^[a-z][a-zA-Z0-9_-]*$/.test(t.name as string));
  const styles = new Set(tools.map((t) => {
    const n = String(t.name);
    if (n.includes('_')) return 'snake';
    if (n.includes('-')) return 'kebab';
    if (/[A-Z]/.test(n)) return 'camel';
    return 'lower';
  }));
  if (bad.length === 0 && styles.size <= 2) {
    return makeResult(m, 'pass', `Consistent naming across ${tools.length} tools (${[...styles].join('/')})`, evidenceOf(s));
  }
  const problems = [bad.length ? `${bad.length} invalid names` : null, styles.size > 2 ? 'mixed naming styles' : null].filter(Boolean).join('; ');
  return makeResult(m, 'warn', `Naming inconsistency: ${problems}`, evidenceOf(s));
});

export const mcpToolAnnotations = make('mcp-tool-annotations', 'MCP tool annotations', async (s) => {
  const m = meta('mcp-tool-annotations', 'MCP tool annotations');
  const tools = await s.getTools();
  if (tools.length === 0) return makeResult(m, 'skip', 'No tools to grade', {});
  const annotated = tools.filter((t) => isRecord(t.annotations) && (
    'readOnlyHint' in t.annotations || 'destructiveHint' in t.annotations || 'idempotentHint' in t.annotations
  ));
  if (annotated.length === tools.length) return makeResult(m, 'pass', `All ${tools.length} tools carry safety annotations`, evidenceOf(s));
  if (annotated.length === 0) return makeResult(m, 'warn', 'No tools annotated with readOnlyHint/destructiveHint', evidenceOf(s));
  return makeResult(m, 'warn', `Only ${annotated.length}/${tools.length} tools annotated`, evidenceOf(s));
});

export const mcpErrorHandling = make('mcp-error-handling', 'MCP error handling', async (s) => {
  const m = meta('mcp-error-handling', 'MCP error handling');
  const r = await s.call('agent-readiness/nonexistent-method');
  if (r.error && typeof r.error.code === 'number') {
    return makeResult(m, 'pass', `Structured JSON-RPC error (${r.error.code}: ${String(r.error.message ?? '').slice(0, 60)})`, evidenceOf(s));
  }
  return makeResult(m, 'warn', `Bogus method returned HTTP ${r.status} without a structured JSON-RPC error`, evidenceOf(s));
});

export const mcpTransportModern = make('mcp-transport-modern', 'MCP modern transport', (s) => {
  const m = meta('mcp-transport-modern', 'MCP modern transport');
  if (s.transport === 'streamable-http') return makeResult(m, 'pass', 'Streamable HTTP transport accepted', evidenceOf(s));
  if (s.transport === 'legacy-sse') return makeResult(m, 'warn', 'Legacy SSE-only transport — upgrade to Streamable HTTP', evidenceOf(s));
  return makeResult(m, 'warn', 'Transport unclear', evidenceOf(s));
});

export const mcpAuthMechanism = make('mcp-auth-mechanism', 'MCP auth mechanism', (s) => {
  const m = meta('mcp-auth-mechanism', 'MCP auth mechanism');
  if (s.initStatus === 401 || s.initStatus === 403) {
    return makeResult(m, 'pass', `Server requires authentication (HTTP ${s.initStatus})`, evidenceOf(s));
  }
  if (s.initOk) return makeResult(m, 'pass', 'Server is open — appropriate for read-only/docs servers', evidenceOf(s));
  return makeResult(m, 'warn', `initialize returned HTTP ${s.initStatus}`, evidenceOf(s));
});

export const mcpOauthMetadata = make('mcp-oauth-metadata', 'MCP OAuth metadata', async (s, _t, http) => {
  const m = meta('mcp-oauth-metadata', 'MCP OAuth metadata');
  const origin = new URL(s.url).origin;
  const pr = await fetchJsonWellKnown(new URL(origin), '/.well-known/oauth-protected-resource', http);
  if (pr.ok) return makeResult(m, 'pass', 'Protected Resource Metadata published for MCP origin', pr.evidence);
  const as = await fetchJsonWellKnown(new URL(origin), '/.well-known/oauth-authorization-server', http);
  if (as.ok) return makeResult(m, 'pass', 'Authorization Server metadata published', as.evidence);
  return makeResult(m, 'warn', 'No OAuth metadata on MCP origin (RFC 9728/8414)', {});
});

export const mcpPkceS256 = make('mcp-pkce-s256', 'MCP PKCE S256 support', async (s, _t, http) => {
  const m = meta('mcp-pkce-s256', 'MCP PKCE S256 support');
  const origin = new URL(s.url).origin;
  const as = await fetchJsonWellKnown(new URL(origin), '/.well-known/oauth-authorization-server', http);
  if (!as.ok) return makeResult(m, 'skip', 'No authorization server metadata to inspect', {});
  const methods = isRecord(as.data) && Array.isArray(as.data.code_challenge_methods_supported)
    ? (as.data.code_challenge_methods_supported as unknown[]) : [];
  if (methods.includes('S256')) return makeResult(m, 'pass', 'PKCE S256 advertised', as.evidence);
  return makeResult(m, 'warn', 'PKCE S256 not in code_challenge_methods_supported', as.evidence);
});

export const mcpResourceListing = make('mcp-resource-listing', 'MCP resources exposed', async (s) => {
  const m = meta('mcp-resource-listing', 'MCP resources exposed');
  const hasCap = Boolean(s.capabilities && s.capabilities.resources);
  const resources = await s.getResources();
  if (resources.length > 0) return makeResult(m, 'pass', `${resources.length} resources listed`, evidenceOf(s));
  if (hasCap) return makeResult(m, 'warn', 'Capabilities advertise resources but resources/list returned none', evidenceOf(s));
  return makeResult(m, 'skip', 'Server does not advertise a resources capability', evidenceOf(s));
});

export const mcpResourceQuality = make('mcp-resource-quality', 'MCP resource quality', async (s) => {
  const m = meta('mcp-resource-quality', 'MCP resource quality');
  const resources = await s.getResources();
  if (resources.length === 0) return makeResult(m, 'skip', 'No resources to grade', {});
  const weak = resources.filter((r) => typeof r.uri !== 'string' || typeof r.name !== 'string');
  if (weak.length === 0) {
    const described = resources.filter((r) => r.description || r.mimeType).length;
    return makeResult(m, 'pass', `${resources.length} resources valid; ${described} with description/mimeType`, evidenceOf(s));
  }
  return makeResult(m, 'warn', `${weak.length}/${resources.length} resources missing uri or name`, evidenceOf(s));
});

export const mcpMultiSurfaceCoverage = make('mcp-multi-surface-coverage', 'Product + docs MCP coverage', async (s, target, http) => {
  const m = meta('mcp-multi-surface-coverage', 'Product + docs MCP coverage');
  let mcpMentions = 0;
  for (const path of ['/.well-known/ard.json', '/.well-known/ai-catalog.json', '/llms.txt']) {
    try {
      const res = await fetchText(new URL(path, target.origin).toString(), http);
      if (res.status === 200 && /mcp/i.test(res.text)) mcpMentions++;
    } catch { /* ignore */ }
  }
  const note = `${mcpMentions} catalog file(s) reference MCP`;
  if (mcpMentions >= 2) return makeResult(m, 'pass', `MCP surfaces advertised across multiple catalogs (${note})`, { note });
  return makeResult(m, 'warn', `MCP advertised in ${mcpMentions} catalog files — document product vs docs server split`, { note });
});

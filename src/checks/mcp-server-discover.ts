import type { Check, CheckResult, Evidence } from '../types';
import { VERSION } from '../version';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'mcp-server-discover',
  category: 'capabilities' as const,
  title: 'MCP server/discover (2026-07-28 RC)',
  spec: { url: 'https://modelcontextprotocol.io/specification/draft/server/discover', asOf: '2026-08-04' },
};

function parseResponse(body: string, contentType: string): unknown {
  if (/text\/event-stream/i.test(contentType)) {
    const data = body.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter((line) => line && line !== '[DONE]').at(-1);
    return data ? JSON.parse(data) : null;
  }
  return JSON.parse(body);
}

const mcpServerDiscover: Check = {
  ...META,
  defaultEnabled: false,
  scored: false,

  async run(_target, http, options): Promise<CheckResult> {
    if (!options?.mcpUrl) return makeResult(META, 'skip', 'Provide --mcp-url to probe server/discover', {});
    const url = options.mcpUrl.toString();
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 'agent-readiness-discover',
      method: 'server/discover',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'agent-readiness', version: VERSION },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    });
    const headers = {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'server/discover',
    };
    const response = await http.fetch(url, { method: 'POST', headers, body: payload });
    const body = decodeBody(response.body);
    const evidence: Evidence = {
      request: { method: 'POST', url, headers },
      response: { status: response.status, contentType: response.contentType, bytes: response.body.length, preview: body.slice(0, 256), finalUrl: response.finalUrl },
      note: 'Read-only capability discovery; no tools, prompts, or resources were invoked.',
    };
    if (response.status !== 200) return makeResult(META, 'warn', `server/discover returned HTTP ${response.status}`, evidence);
    let parsed: unknown;
    try { parsed = parseResponse(body, response.contentType); }
    catch { return makeResult(META, 'warn', 'server/discover response is not valid JSON or SSE JSON', evidence); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return makeResult(META, 'warn', 'server/discover response must be a JSON-RPC object', evidence);
    const rpc = parsed as Record<string, unknown>;
    if (rpc.error) return makeResult(META, 'warn', 'Server returned a JSON-RPC error for server/discover', evidence);
    const result = rpc.result as Record<string, unknown> | undefined;
    if (!result || !Array.isArray(result.supportedVersions) || !result.capabilities || typeof result.capabilities !== 'object') {
      return makeResult(META, 'warn', 'Discovery result needs supportedVersions and capabilities', evidence);
    }
    return makeResult(META, 'pass', `Supports ${result.supportedVersions.join(', ')}; capabilities: ${Object.keys(result.capabilities as object).join(', ') || 'none'}`, evidence);
  },
};

export default mcpServerDiscover;

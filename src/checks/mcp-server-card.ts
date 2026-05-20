import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'mcp-server-card',
  category: 'capabilities' as const,
  title: 'MCP Server Card',
  spec: { url: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json', asOf: '2026-04-17' },
};

const REQUIRED = ['protocolVersion', 'serverInfo', 'transport'] as const;

const mcpServerCard: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/mcp/server-card.json', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as Record<string, unknown>;
    const missing = REQUIRED.filter((k) => !(k in data));
    if (missing.length) {
      return makeResult(META, 'fail', `JSON missing required fields: ${missing.join(', ')}`, r.evidence);
    }
    const serverInfo = (data.serverInfo ?? {}) as { name?: string };
    return makeResult(META, 'pass', `${serverInfo.name ?? '?'} (protocol ${String(data.protocolVersion)})`, r.evidence);
  },
};

export default mcpServerCard;

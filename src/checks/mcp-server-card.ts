import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'mcp-server-card',
  category: 'capabilities' as const,
  title: 'MCP Server Card',
  spec: { url: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json', asOf: '2026-05-20' },
};

const mcpServerCard: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/mcp/server-card.json', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as Record<string, unknown>;

    if (!data.transport) {
      return makeResult(META, 'fail', 'JSON parses but missing required "transport" field', r.evidence);
    }

    const serverInfo = data.serverInfo as { name?: unknown; version?: unknown } | undefined;
    if (!serverInfo || typeof serverInfo.name !== 'string' || !serverInfo.name) {
      return makeResult(META, 'fail', 'JSON missing required serverInfo.name', r.evidence);
    }

    const hasProtocolVersion = 'protocolVersion' in data && data.protocolVersion != null;
    const versionStr = serverInfo.version != null ? String(serverInfo.version) : '?';

    if (hasProtocolVersion) {
      return makeResult(
        META,
        'pass',
        `${serverInfo.name} (v1.json, protocol ${String(data.protocolVersion)})`,
        r.evidence,
      );
    }

    return makeResult(
      META,
      'pass',
      `${serverInfo.name} v${versionStr} (SEP-1649 / server-card-v1)`,
      r.evidence,
    );
  },
};

export default mcpServerCard;

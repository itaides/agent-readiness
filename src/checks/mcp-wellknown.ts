import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, fetchText, getEvidence, isRecord, makeResult } from './_shared';

const META = {
  id: 'mcp-well-known-discovery',
  category: 'content' as const,
  title: 'MCP well-known discovery',
  spec: { url: 'https://modelcontextprotocol.io/', asOf: '2026-10-22' },
};

const mcpWellKnownDiscovery: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const found: string[] = [];

    const card = await fetchJsonWellKnown(target.origin, '/.well-known/mcp/server-card.json', http);
    if (card.ok) found.push('server-card.json');

    const manifest = await fetchJsonWellKnown(target.origin, '/.well-known/mcp.json', http);
    if (manifest.ok) found.push('mcp.json');

    const redirect = await fetchText(new URL('/.well-known/mcp', target.origin).toString(), http);
    if (redirect.status === 200 && redirect.finalUrl !== new URL('/.well-known/mcp', target.origin).toString() && /json|event-stream|mcp/i.test(redirect.contentType)) {
      found.push('/.well-known/mcp redirect');
    }

    for (const path of ['/.well-known/ard.json', '/.well-known/ai-catalog.json']) {
      const res = await fetchText(new URL(path, target.origin).toString(), http);
      if (res.status === 200 && /json/i.test(res.contentType)) {
        try {
          const d = JSON.parse(res.text);
          if (JSON.stringify(d).match(/"type"\s*:\s*"mcp"|mcp:/i)) found.push(`${path} lists an MCP entry`);
        } catch { /* ignore */ }
      }
    }

    const llms = await fetchText(new URL('/llms.txt', target.origin).toString(), http);
    if (llms.status === 200 && /\bmcp\b|model context protocol/i.test(llms.text)) found.push('llms.txt mentions MCP');

    const evidence = { note: found.join('; ') || 'none found' };
    if (found.length) return makeResult(META, 'pass', `MCP discoverable via: ${found.join(', ')}`, evidence);
    return makeResult(META, 'warn', 'No MCP discovery surface (server-card, mcp.json, catalog entry, or llms.txt mention)', {});
  },
};

export default mcpWellKnownDiscovery;

import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, fetchPage, isRecord, makeResult } from './_shared';

const META = {
  id: 'a2ui-support',
  category: 'capabilities' as const,
  title: 'A2UI / generative UI support',
  spec: { url: 'https://modelcontextprotocol.io/extensions/apps/overview', asOf: '2026-10-22' },
};

const a2uiSupport: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const signals: string[] = [];

    const card = await fetchJsonWellKnown(target.origin, '/.well-known/mcp/server-card.json', http);
    if (card.ok && /io\.modelcontextprotocol\/ui|"ui"|apps-sdk|widget/i.test(JSON.stringify(card.data))) {
      signals.push('MCP server card advertises a UI extension');
    }

    const page = await fetchPage(target.contentUrl.toString(), http);
    if (page.status === 200 && /openai(?:\.|-|_)apps?[-_]?sdk|a2ui|modelcontextprotocol\/ui|window\.openai/i.test(page.body)) {
      signals.push('page references an agent-UI SDK');
    }

    const ard = await fetchJsonWellKnown(target.origin, '/.well-known/ard.json', http);
    if (ard.ok && isRecord(ard.data) && /"type"\s*:\s*"(?:ui|a2ui|app)"|a2ui/i.test(JSON.stringify(ard.data))) {
      signals.push('ARD catalog lists a UI surface');
    }

    if (signals.length) return makeResult(META, 'pass', signals.join('; '), {});
    return makeResult(META, 'warn', 'No in-agent UI surface detected (MCP Apps, OpenAI Apps SDK, A2UI)', {});
  },
};

export default a2uiSupport;

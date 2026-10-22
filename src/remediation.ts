import type { CheckResult } from './types';

interface Guidance {
  suggestion: string;
  prompt?: boolean;
  verify?: (target: string) => string;
}

const GUIDANCE: Record<string, Guidance> = {
  'robots-txt': {
    suggestion: 'Serve /robots.txt as text/plain with at least one User-agent group and advertise the canonical sitemap URL.',
    prompt: true,
  },
  sitemap: {
    suggestion: 'Serve a valid XML sitemap at /sitemap.xml or declare its absolute URL with a Sitemap directive in robots.txt.',
    prompt: true,
  },
  'link-header-api-catalog': {
    suggestion: 'After publishing an API catalog, add Link: </.well-known/api-catalog>; rel="api-catalog" to the root response.',
    prompt: true,
  },
  'dns-aid': {
    suggestion: 'If adopting the DNS-AID draft, publish an SVCB/HTTPS record at _index._agents.<host>; otherwise treat this as a low-priority informational finding.',
  },
  'markdown-negotiation': {
    suggestion: 'Return Markdown plus Content-Type: text/markdown and Vary: Accept for requests accepting text/markdown. On Cloudflare, enable Markdown for Agents in AI Crawl Control.',
    prompt: true,
  },
  'llms-txt': {
    suggestion: 'Publish /llms.txt as text/plain or text/markdown with an H1 and curated links to the most useful agent-facing content.',
    prompt: true,
  },
  'content-signal': {
    suggestion: 'Choose an explicit policy and send valid search, ai-input, and ai-train directives from the origin Content-Signal header or robots.txt.',
    prompt: true,
  },
  'ai-bot-rules': {
    suggestion: 'Add explicit robots.txt User-agent groups for the AI crawlers you intend to allow or block; preserve the site owner policy rather than assuming allow or deny.',
    prompt: true,
  },
  'bot-policy-matrix': {
    suggestion: 'Document explicit Search, Agent, and Training bot policies in robots.txt so each use category has an intentional stance.',
  },
  'web-bot-auth': {
    suggestion: 'If accepting signed agent traffic, publish current public verification keys at /.well-known/http-message-signatures-directory as a JSON key array.',
    prompt: true,
  },
  'a2a-agent-card': {
    suggestion: 'If the site exposes an A2A agent, publish a valid Agent Card at /.well-known/agent-card.json with interfaces, capabilities, modes, and skills.',
    prompt: true,
  },
  'agent-skills': {
    suggestion: 'Publish a v0.2 Agent Skills index at /.well-known/agent-skills/index.json with unique entries, artifact URLs, and lowercase SHA-256 digests.',
    prompt: true,
    verify: (target) => `agent-readiness ${target} --only agent-skills --verify-skill-digests`,
  },
  'api-catalog': {
    suggestion: 'If the site exposes APIs, publish an RFC 9727 linkset at /.well-known/api-catalog and advertise it from the root Link header.',
    prompt: true,
  },
  'oauth-authorization-server': {
    suggestion: 'If agents authenticate here, publish RFC 8414 authorization-server metadata with the canonical issuer and supported OAuth endpoints.',
    prompt: true,
  },
  'oauth-protected-resource': {
    suggestion: 'If this origin is an OAuth-protected API, publish RFC 9728 metadata with the canonical resource identifier and authorization servers.',
    prompt: true,
  },
  'mcp-server-card': {
    suggestion: 'If the site exposes MCP, publish /.well-known/mcp/server-card.json with transport details and a non-empty serverInfo.name.',
    prompt: true,
  },
  webmcp: {
    suggestion: 'Register intentional browser tools with navigator.modelContext or publish a WebMCP manifest, then rerun with --browser for runtime evidence.',
    prompt: true,
    verify: (target) => `agent-readiness ${target} --only webmcp --browser`,
  },
  'auth-md': {
    suggestion: 'For agent-facing APIs, publish /auth.md as Markdown guidance that points agents to authoritative OAuth Protected Resource Metadata.',
  },
  'mcp-server-discover': {
    suggestion: 'Implement the read-only server/discover JSON-RPC method at the MCP endpoint and return supportedVersions plus capabilities.',
    verify: (target) => `agent-readiness ${target} --only mcp-server-discover --mcp-url <mcp-url>`,
  },
  'browser-agentic': {
    suggestion: 'Install Lighthouse 13.3+ and Chrome 150+, rerun with --browser, then address the failed agentic-browsing audit IDs.',
    verify: (target) => `agent-readiness ${target} --only browser-agentic --browser`,
  },
  ucp: {
    suggestion: 'For agent commerce, publish /.well-known/ucp with a dated version plus object-valued services and payment_handlers.',
    prompt: true,
    verify: (target) => `agent-readiness ${target} --only ucp --commerce-url <paid-resource-url>`,
  },
  x402: {
    suggestion: 'Make the paid resource return HTTP 402 with a Base64 JSON PAYMENT-REQUIRED header declaring x402Version 2 and accepted payment options.',
    prompt: true,
    verify: (target) => `agent-readiness ${target} --only x402 --commerce-url <paid-resource-url>`,
  },
  mpp: {
    suggestion: 'Make the paid resource return HTTP 402 with a valid WWW-Authenticate: Payment challenge; the scanner will not send payment credentials.',
    prompt: true,
    verify: (target) => `agent-readiness ${target} --only mpp --commerce-url <paid-resource-url>`,
  },
};

export function addRemediation(result: CheckResult, target: string): CheckResult {
  if (result.status === 'pass' || result.status === 'skip') return result;

  if (result.message.startsWith('Internal error:')) {
    return {
      ...result,
      remediation: {
        suggestion: 'Rerun the check with a longer timeout and inspect its evidence; report a tool bug if the internal error is reproducible.',
        verifyCommand: `agent-readiness ${target} --only ${result.id} --timeout 10000`,
      },
    };
  }

  const guidance = GUIDANCE[result.id];
  if (!guidance) {
    return {
      ...result,
      remediation: {
        suggestion: 'See docs/checks.md for this check\'s pass criteria, implement the missing artifact or signal, then rerun the targeted verification.',
        verifyCommand: `agent-readiness ${target} --only ${result.id}`,
      },
    };
  }

  const promptPath = guidance.prompt ? `prompts/${result.id}.md` : undefined;
  return {
    ...result,
    remediationPromptPath: promptPath,
    remediation: {
      suggestion: guidance.suggestion,
      promptPath,
      verifyCommand: guidance.verify?.(target) ?? `agent-readiness ${target} --only ${result.id}`,
    },
  };
}

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Fixture {
  url: string;
  origin: URL;
  close: () => Promise<void>;
}

export type FixtureMode = 'all-pass' | 'all-fail-spa';

const ROBOTS_TXT = `# Fixture robots.txt
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /docs/

User-agent: ClaudeBot
Allow: /

Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: %BASE_URL%/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>%BASE_URL%/article-1</loc></url>
  <url><loc>%BASE_URL%/article-2</loc></url>
</urlset>
`;

const LLMS_TXT = `# Fixture Site
> Demo content for agent-readiness e2e test.
## Articles
- [Article 1](/article-1.md)
`;

const AGENT_SKILLS = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [
    {
      name: 'search',
      type: 'skill-md',
      description: 'Search fixture docs',
      url: '/.well-known/agent-skills/search/SKILL.md',
      digest: 'sha256:a617f064ccc65d7426d73f7b4221811ee3801f38b156560c54c49ec064e438a6',
    },
  ],
};

const SKILL_MD = `---
name: search
description: Search fixture docs
---

# Search
`;

const A2A_CARD = {
  name: 'fixture-agent',
  description: 'Fixture A2A agent',
  version: '1.0.0',
  supportedInterfaces: [
    { url: 'http://127.0.0.1/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
  ],
  capabilities: { streaming: false },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    { id: 'search', name: 'Search', description: 'Search fixture docs', tags: ['search'] },
  ],
};

const API_CATALOG = {
  linkset: [
    { anchor: '/api/v1', rel: 'service-desc', href: '/api/v1/openapi.json' },
  ],
};

const OAUTH_AS = {
  issuer: 'https://example.com',
  authorization_endpoint: 'https://example.com/oauth/authorize',
  token_endpoint: 'https://example.com/oauth/token',
};

const OAUTH_PR = {
  resource: 'https://example.com/api',
  authorization_servers: ['https://example.com'],
};

const MCP_CARD = {
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'fixture-mcp-server', version: '1.0.0' },
  transport: { type: 'streamable-http', endpoint: '/mcp' },
};

const WEB_BOT_AUTH = {
  keys: [
    { kid: 'key-1', kty: 'OKP', crv: 'Ed25519', x: 'fixture-public-key-base64url' },
  ],
};

const MARKDOWN_PAGE = `# Article 1\n\nFixture markdown content used to satisfy markdown-negotiation.\n`;

const AUTH_MD = `# auth.md

## Discover

Fetch /.well-known/oauth-protected-resource before registering.
`;

function passHandler(req: IncomingMessage, res: ServerResponse, baseUrl: string): void {
  const accept = req.headers.accept ?? '';
  const url = req.url ?? '/';

  if (url === '/' || url === '/article-1') {
    if (/text\/markdown/i.test(accept)) {
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
      res.end(MARKDOWN_PAGE);
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      link: '</.well-known/api-catalog>; rel="api-catalog"',
      'content-signal': 'ai-train=no, search=yes, ai-input=yes',
    });
    res.end('<!doctype html><html><body><h1>Fixture</h1><script>navigator.modelContext.registerTool({name:"x"});</script></body></html>');
    return;
  }
  if (url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(ROBOTS_TXT.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (url === '/sitemap.xml') {
    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
    res.end(SITEMAP_XML.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (url === '/llms.txt') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(LLMS_TXT);
    return;
  }
  if (url === '/.well-known/agent-skills/index.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(AGENT_SKILLS));
    return;
  }
  if (url === '/.well-known/agent-skills/search/SKILL.md') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(SKILL_MD);
    return;
  }
  if (url === '/.well-known/agent-card.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(A2A_CARD));
    return;
  }
  if (url === '/auth.md') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(AUTH_MD);
    return;
  }
  if (url === '/.well-known/api-catalog') {
    res.writeHead(200, { 'content-type': 'application/linkset+json' });
    res.end(JSON.stringify(API_CATALOG));
    return;
  }
  if (url === '/.well-known/oauth-authorization-server') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(OAUTH_AS));
    return;
  }
  if (url === '/.well-known/oauth-protected-resource') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(OAUTH_PR));
    return;
  }
  if (url === '/.well-known/mcp/server-card.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(MCP_CARD));
    return;
  }
  if (url === '/.well-known/http-message-signatures-directory') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(WEB_BOT_AUTH));
    return;
  }
  res.writeHead(404);
  res.end();
}

function spaFallthroughHandler(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><body><div id="root"></div></body></html>');
}

export function startFixtureServer(mode: FixtureMode): Promise<Fixture> {
  return new Promise((resolveP) => {
    const server: Server = createServer((req, res) => {
      if (mode === 'all-pass') {
        const port = (server.address() as AddressInfo).port;
        passHandler(req, res, `http://127.0.0.1:${port}`);
      } else {
        spaFallthroughHandler(req, res);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolveP({
        url: baseUrl,
        origin: new URL(baseUrl),
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

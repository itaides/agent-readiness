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
Schemamap: %BASE_URL%/.well-known/feeds.json

Sitemap: %BASE_URL%/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>%BASE_URL%/article-1</loc><lastmod>2026-10-01</lastmod></url>
  <url><loc>%BASE_URL%/article-2</loc><lastmod>2026-10-01</lastmod></url>
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
  issuer: '%BASE_URL%',
  authorization_endpoint: '%BASE_URL%/oauth/authorize',
  token_endpoint: '%BASE_URL%/oauth/token',
  scopes_supported: ['read', 'write'],
  code_challenge_methods_supported: ['S256'],
  poppy_domains: ['127.0.0.1'],
};

const OAUTH_PR = {
  resource: '%BASE_URL%/api',
  authorization_servers: ['%BASE_URL%'],
};

const MCP_CARD = {
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'fixture-mcp-server', version: '1.0.0' },
  transport: { type: 'streamable-http', endpoint: '/mcp' },
  extensions: { 'io.modelcontextprotocol/ui': { version: '1.0' } },
};

const WEB_BOT_AUTH = {
  keys: [
    { kid: 'key-1', kty: 'OKP', crv: 'Ed25519', x: 'fixture-public-key-base64url' },
  ],
};

const MARKDOWN_PAGE = `---
title: Fixture Article
source: fixture
---
# Article 1

Fixture markdown content used to satisfy markdown-negotiation. This body is intentionally
long enough to exercise token-budget and content-length heuristics: it describes the fixture
product, its API surface, its authentication model, and the agent-facing artifacts published
by the site. Agents reading this page learn that Fixture exposes a versioned REST API with
idempotency keys, cursor pagination, async jobs, batch endpoints, and typed JSON errors, plus
an MCP server and OpenAPI catalog for discovery. The site also publishes llms.txt, an ARD
catalog, a Poppy discovery document, pricing and trust-anchor pages, so a scanner can verify
the complete agent-readiness surface deterministically in tests.
`;

const HTML_PAGE = `<!doctype html><html lang="en"><head>
<title>Fixture</title>
<meta name="description" content="A fixture API and documentation site with enough descriptive text to satisfy the meta description length requirement.">
<meta property="og:title" content="Fixture">
<meta property="og:description" content="Fixture docs for agents">
<meta property="og:type" content="website">
<meta property="og:image" content="%BASE_URL%/og.png">
<link rel="canonical" href="%BASE_URL%/">
<link rel="alternate" type="text/markdown" href="/index.md">
<link rel="alternate" type="application/rss+xml" href="/feed.xml">
<script type="application/ld+json">{"@type":"Organization","name":"Fixture","url":"%BASE_URL%","logo":"%BASE_URL%/logo.png","contactPoint":{"@type":"ContactPoint","email":"hi@fixture.test"},"sameAs":["https://github.com/fixture","https://en.wikipedia.org/wiki/Fixture"],"dateModified":"2026-10-01"}</script>
<script type="application/ld+json">{"@type":"WebSite","name":"Fixture","url":"%BASE_URL%"}</script>
</head><body>
<nav><a href="/docs">Docs</a> <a href="/developers">Developers</a> <a href="/pricing">Pricing</a></nav>
<main>
<h1>Fixture</h1><h2>Install</h2><h2>Usage</h2>
<p>${'Readable fixture content for agent checks. '.repeat(40)}</p>
<a href="/article-1">Read the first article</a>
<a href="/docs">API documentation</a>
<a href="/developers">Get started — developer console</a>
<a href="/sandbox">Try the sandbox</a>
<button type="button">Get started</button>
<time datetime="2026-10-01">October 2026</time>
<script>navigator.modelContext.registerTool({name:"x"});</script>
</main>
</body></html>`;

const SITEMAP_MD = `# Fixture docs\n\n- [Article 1](/article-1.md)\n`;

const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Fixture</title><link>%BASE_URL%</link><item><title>A1</title></item></channel></rss>`;

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: { title: 'Fixture API', version: '1.0.0' },
  servers: [
    { url: '%BASE_URL%/api/v1', description: 'production' },
    { url: '%BASE_URL%/api/sandbox', description: 'sandbox test environment' },
  ],
  paths: {
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        description: 'Returns a paginated list of items.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array' }, next_cursor: { type: 'string' } } } } } },
          '429': { description: 'rate limited', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
      post: {
        operationId: 'createItem',
        summary: 'Create item',
        description: 'Creates an item; safe to retry with Idempotency-Key.',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'created', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: 'bad request', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/jobs/{id}': {
      get: {
        operationId: 'getJob',
        summary: 'Poll async job status',
        description: 'Polls a long-running job created with 202 Accepted.',
        responses: {
          '200': { description: 'job status', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
          '404': { description: 'not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/batch': {
      post: {
        operationId: 'batchItems',
        summary: 'Batch create items',
        description: 'Creates many items in one call.',
        responses: {
          '202': { description: 'accepted', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
  },
  components: {
    schemas: { Error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } },
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
  },
};

const AUTH_MD = `# auth.md

Issuer: %BASE_URL%

## Discover

Fetch /.well-known/oauth-protected-resource before registering.

## Credentials

POST %BASE_URL%/oauth/token with your client credentials.
`;

const ARD_CATALOG = {
  spec: 'ard-0.91',
  trustManifest: '%BASE_URL%/.well-known/trust.json',
  entries: [
    { id: 'urn:air:fixture:api', name: 'Fixture REST API', media_type: 'application/json', url: '%BASE_URL%/api/v1' },
    { id: 'urn:air:fixture:mcp', name: 'Fixture MCP', media_type: 'application/json', url: '%BASE_URL%/mcp' },
  ],
};

const AGENT_JSON = {
  name: 'fixture',
  description: 'Fixture agent-facing site used by the agent-readiness e2e tests.',
  services: { mcp: '%BASE_URL%/mcp', api: '%BASE_URL%/api/v1' },
};

const AI_PLUGIN = {
  schema_version: 'v1',
  name_for_model: 'fixture',
  name_for_human: 'Fixture',
  description_for_model: 'Fixture plugin manifest.',
  api: { type: 'openapi', url: '%BASE_URL%/openapi.json' },
};

const POPPY = {
  protocol_version: '0.2',
  organization: { name: 'Fixture', domain: '127.0.0.1' },
  apis: [
    { type: 'openapi', url: '%BASE_URL%/openapi.json', description: 'Fixture REST API' },
    { type: 'mcp', url: '%BASE_URL%/mcp', description: 'Fixture MCP server' },
  ],
  agent: { protocols: [{ type: 'mcp', endpoint: '%BASE_URL%/mcp' }] },
  auth: { issuer: '%BASE_URL%', direct: { scopes: ['read'] } },
};

const MCP_WELLKNOWN = {
  version: '2025-06-18',
  servers: [{ name: 'fixture-mcp-server', endpoint: '/mcp' }],
};

const FEEDS_JSON = {
  feeds: [{ url: '%BASE_URL%/feed.xml', type: 'application/rss+xml', schema: 'rss' }],
};

function passHandler(req: IncomingMessage, res: ServerResponse, baseUrl: string): void {
  const accept = req.headers.accept ?? '';
  const rawUrl = req.url ?? '/';
  const [url, query] = rawUrl.split('?');
  const json = (data: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(200, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(data).replaceAll('%BASE_URL%', baseUrl));
  };
  const html = (body: string) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  };
  const md = (body: string) => {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(body);
  };
  const SIMPLE_PAGE = `<!doctype html><html lang="en"><head><title>Fixture page</title></head><body><main><h1>Fixture page</h1><p>${'Trust-anchor content for agent checks. '.repeat(6)}</p></main></body></html>`;

  // Agent-mode view: same URL, markdown variant for agents.
  if (/^mode=agent/.test(query ?? '')) {
    md(MARKDOWN_PAGE);
    return;
  }

  if (url === '/ask' || url === '/api/ask' || url === '/nlweb/ask') {
    if (req.method === 'POST') {
      if (/text\/event-stream/i.test(accept)) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('event: message\ndata: {"answer":"fixture"}\n\n');
      } else {
        json({ answer: 'fixture answer', query_id: 'agent-readiness-probe' });
      }
      return;
    }
  }

  if (url === '/api/v1/items') {
    if (req.method === 'POST') {
      json({ id: 'item-1' }, { 'ratelimit-limit': '100', 'ratelimit-remaining': '99' });
      return;
    }
    json({ items: [], next_cursor: null }, { 'ratelimit-limit': '100', 'ratelimit-remaining': '99' });
    return;
  }
  if (url === '/api/v1/openapi.json') {
    json(OPENAPI_SPEC);
    return;
  }
  if (url.startsWith('/api/v1/') || url.startsWith('/api/sandbox/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: 'not_found', message: 'resource does not exist' }));
    return;
  }

  if (url === '/' || url === '/article-1' || url === '/article-2') {
    if (/text\/markdown/i.test(accept)) {
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' });
      res.end(MARKDOWN_PAGE);
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      link: '</.well-known/api-catalog>; rel="api-catalog"',
      'content-signal': 'ai-train=no, search=yes, ai-input=yes',
      'tdm-reservation': '1',
      'last-modified': 'Wed, 01 Oct 2026 00:00:00 GMT',
    });
    res.end(HTML_PAGE.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (url === '/index.md' || url === '/article-1.md' || url === '/article-2.md') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(MARKDOWN_PAGE);
    return;
  }
  if (url === '/sitemap.md') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(SITEMAP_MD);
    return;
  }
  if (url === '/agents.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ name: 'fixture', capabilities: { mcp: true } }));
    return;
  }
  if (url === '/openapi.json') {
    json(OPENAPI_SPEC);
    return;
  }
  if (url === '/.well-known/ard.json') {
    json(ARD_CATALOG);
    return;
  }
  if (url === '/.well-known/agent.json' || url === '/agent.json') {
    json(AGENT_JSON);
    return;
  }
  if (url === '/.well-known/ai-plugin.json') {
    json(AI_PLUGIN);
    return;
  }
  if (url === '/.well-known/poppy.json') {
    json(POPPY);
    return;
  }
  if (url === '/.well-known/mcp') {
    json(MCP_WELLKNOWN);
    return;
  }
  if (url === '/.well-known/feeds.json') {
    json(FEEDS_JSON);
    return;
  }
  if (url === '/about' || url === '/contact' || url === '/docs' || url === '/developers' || url === '/sandbox') {
    html(SIMPLE_PAGE);
    return;
  }
  if (url === '/pricing') {
    html(`<!doctype html><html><body><main><h1>Pricing</h1><p>Free tier plus $20 per month pro plans.</p></main></body></html>`);
    return;
  }
  if (url === '/pricing.md') {
    md('# Pricing\n\nFree tier. Pro: $20/month.\n');
    return;
  }
  if (url === '/feed.xml') {
    res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
    res.end(RSS_FEED.replaceAll('%BASE_URL%', baseUrl));
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
    md(AUTH_MD.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (url === '/.well-known/api-catalog') {
    res.writeHead(200, { 'content-type': 'application/linkset+json' });
    res.end(JSON.stringify(API_CATALOG));
    return;
  }
  if (url === '/.well-known/oauth-authorization-server') {
    json(OAUTH_AS);
    return;
  }
  if (url === '/.well-known/oauth-protected-resource') {
    json(OAUTH_PR);
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

function spaFallthroughHandler(req: IncomingMessage, res: ServerResponse): void {
  const ua = req.headers['user-agent'] ?? '';
  if (/GPTBot|ClaudeBot/i.test(ua)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('blocked');
    return;
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex',
  });
  res.end('<!doctype html><html><body><div id="root"></div></body></html>');
}

export function startFixtureServer(mode: FixtureMode, port = 0): Promise<Fixture> {
  return new Promise((resolveP) => {
    const server: Server = createServer((req, res) => {
      if (mode === 'all-pass') {
        const port = (server.address() as AddressInfo).port;
        passHandler(req, res, `http://127.0.0.1:${port}`);
      } else {
        spaFallthroughHandler(req, res);
      }
    });
    server.listen(port, '127.0.0.1', () => {
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

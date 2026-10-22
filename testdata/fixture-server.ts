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
  <url><loc>%BASE_URL%/article-1</loc><lastmod>%TODAY%</lastmod></url>
  <url><loc>%BASE_URL%/article-2</loc><lastmod>%TODAY%</lastmod></url>
</urlset>
`;

const LLMS_TXT = `# Fixture Site
> Demo content for agent-readiness e2e test.

## Articles
- [Article 1](%BASE_URL%/article-1)
- [Docs index](%BASE_URL%/docs/llms.txt)
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

function oauthAs(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
    scopes_supported: ['read', 'write', 'poppy:read'],
    code_challenge_methods_supported: ['S256'],
    poppy_domains: ['127.0.0.1'],
    agent_auth: {
      skill: `${baseUrl}/auth.md`,
      identity_endpoint: `${baseUrl}/agent/identity`,
      claim_endpoint: `${baseUrl}/agent/identity/claim`,
      events_endpoint: `${baseUrl}/agent/event/notify`,
    },
  };
}

const OAUTH_PR = {
  resource: 'https://example.com/api',
  authorization_servers: ['https://example.com'],
  scopes_supported: ['read', 'write'],
};

const MCP_CARD = {
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'fixture-mcp-server', version: '1.0.0' },
  transport: { type: 'streamable-http', endpoint: '/mcp' },
  _meta: { 'io.modelcontextprotocol/ui': { version: '1' } },
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

const AUTH_MD = `# auth.md

Issuer: %BASE_URL%

## Discover

Fetch /.well-known/oauth-protected-resource before registering.

## Register

POST /agent/identity to register.

## Claim

Visit /agent/identity/claim to complete user claiming.

## Exchange

POST /oauth/token to exchange the assertion for an access_token.

## Use

Send Authorization: Bearer to /api/v1/items.

## Errors

Endpoints return JSON errors with a code and message.

## Revocation

POST /oauth/revoke to revoke credentials.
`;

function ardCatalogDoc(baseUrl: string) {
  return {
    specVersion: '0.91',
    entries: [
      {
        identifier: 'urn:air:fixture:mcp',
        displayName: 'Fixture MCP server',
        mediaType: 'application/json',
        url: `${baseUrl}/mcp`,
        type: 'mcp',
        trustManifest: { signatures: ['fixture-sig'] },
      },
      {
        identifier: 'urn:air:fixture:api',
        displayName: 'Fixture API',
        mediaType: 'application/json',
        url: `${baseUrl}/api/v1/openapi.json`,
      },
    ],
  };
}

function aiCatalogDoc(baseUrl: string) {
  return {
    specVersion: '1.0',
    entries: [
      {
        identifier: 'urn:air:fixture:mcp',
        displayName: 'Fixture MCP server',
        mediaType: 'application/json',
        url: `${baseUrl}/mcp`,
      },
    ],
  };
}

function openapiDoc(baseUrl: string) {
  return {
    openapi: '3.1.0',
    info: { title: 'Fixture API', version: '1.0.0' },
    servers: [
      { url: `${baseUrl}/api/v1` },
      { url: `https://sandbox.example.com/api/v1`, description: 'Sandbox environment' },
    ],
    paths: {
      '/items': {
        get: {
          operationId: 'list_items',
          summary: 'List items',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
            default: { description: 'error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        post: {
          operationId: 'create_item',
          summary: 'Create item',
          parameters: [
            { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } },
          ],
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: {
            '202': { description: 'accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } } },
            default: { description: 'error', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/items/{id}': {
        get: {
          operationId: 'get_item',
          summary: 'Get item',
          responses: {
            '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
            default: { description: 'error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/jobs/{id}': {
        get: {
          operationId: 'get_job_status',
          summary: 'Poll async job status',
          responses: {
            '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },
      '/batch': {
        post: {
          operationId: 'batch_items',
          summary: 'Create items in bulk',
          responses: {
            '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
        Job: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } } },
      },
      securitySchemes: {
        oauth: { type: 'oauth2', flows: { clientCredentials: { tokenUrl: `${baseUrl}/oauth/token`, scopes: { read: 'Read', write: 'Write' } } } },
      },
    },
  };
}

function poppyDoc(baseUrl: string) {
  return {
    protocol_version: '0.2',
    organization: { name: 'Fixture Co', domain: '127.0.0.1' },
    auth: {
      issuer: baseUrl,
      direct: { scopes: ['poppy:read', 'poppy:write'] },
      device: { scopes: ['poppy:read'] },
    },
    agent: { protocols: [{ type: 'poppy', endpoint: `${baseUrl}/poppy/conversations` }] },
    apis: [
      { type: 'openapi', url: `${baseUrl}/api/v1/openapi.json`, description: 'Fixture API' },
      { type: 'mcp', url: `${baseUrl}/mcp`, description: 'Fixture MCP' },
    ],
    web: { browser_session_endpoint: `${baseUrl}/poppy/browser-session` },
    extensions: { operations: { version: '0.1', endpoint: `${baseUrl}/poppy/operations` } },
  };
}

const AGENT_JSON = {
  name: 'Fixture Site',
  description: 'Fixture site used by agent-readiness tests',
  services: { api: '/api/v1', mcp: '/mcp' },
};

const AI_PLUGIN = {
  schema_version: 'v1',
  name_for_model: 'fixture',
  name_for_human: 'Fixture',
  description_for_model: 'Fixture plugin',
};

const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<title>Fixture Site — agent-ready demo</title>
<meta name="description" content="Fixture site API and docs for automated agent-readiness verification">
<link rel="canonical" href="%BASE_URL%/">
<link rel="alternate" type="text/markdown" href="%BASE_URL%/index.md">
<meta property="og:image" content="%BASE_URL%/og.png">
<meta property="og:type" content="website">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Fixture Co","url":"%BASE_URL%","logo":"%BASE_URL%/logo.png","contactPoint":{"@type":"ContactPoint","email":"hi@example.com"},"sameAs":["https://github.com/fixture"]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebSite","name":"Fixture Site","url":"%BASE_URL%"}
</script>
</head>
<body>
<header><nav><a href="/docs">Docs</a> <a href="/developers">Developers</a> <a href="/pricing">Pricing</a> <a href="/about">About</a></nav></header>
<main>
<h1>Fixture Site</h1>
<p>Fixture is a demo product for agent-readiness verification. It exposes an API, an MCP server,
structured pricing, and documentation so automated agents can discover, understand, and integrate
with the service end to end. The API offers list, create, batch, and async job operations over JSON.
Developers can sign up, get an API key, and make a first call in minutes. Sandbox keys are available
for safe integration testing. The fixture also publishes llms.txt, an agent skills index, an A2A
agent card, and the OAuth metadata agents need to authenticate. Everything on this site exists so the
scanner can verify every check deterministically against a known-good agent-ready surface, including
markdown content negotiation, structured data, trust anchors, and discovery catalogs.</p>
<form action="/search"><label for="q">Search</label><input id="q" name="q" type="search"><button type="submit">Go</button></form>
<a href="/article-1">Read article 1</a>
</main>
<footer>© Fixture Co</footer>
<script>navigator.modelContext && navigator.modelContext.registerTool({name:"x"});</script>
</body>
</html>`;

function passHandler(req: IncomingMessage, res: ServerResponse, baseUrl: string): void {
  const accept = req.headers.accept ?? '';
  const ua = req.headers['user-agent'] ?? '';
  const [path, query] = (req.url ?? '/').split('?');
  const params = new URLSearchParams(query ?? '');

  const json = (obj: unknown, status = 200, extra: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...extra });
    res.end(JSON.stringify(obj));
  };
  const md = (text: string, status = 200, extra: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': 'text/markdown; charset=utf-8', vary: 'accept', ...extra });
    res.end(text);
  };
  const html = (text: string, status = 200, extra: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...extra });
    res.end(text);
  };

  const isBotUa = /bot/i.test(ua) && !/googlebot|bingbot/i.test(ua);

  if (path === '/' || path === '/article-1' || path === '/docs') {
    if (params.get('mode') === 'agent') {
      md(MARKDOWN_PAGE);
      return;
    }
    if (/text\/markdown/i.test(accept) || isBotUa) {
      md(MARKDOWN_PAGE);
      return;
    }
    html(HOME_HTML.replaceAll('%BASE_URL%', baseUrl), 200, {
      link: '</.well-known/api-catalog>; rel="api-catalog"',
      'content-signal': 'ai-train=no, search=yes, ai-input=yes',
    });
    return;
  }

  if (path === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(ROBOTS_TXT.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (path === '/sitemap.xml') {
    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
    res.end(SITEMAP_XML.replaceAll('%BASE_URL%', baseUrl).replaceAll('%TODAY%', new Date().toISOString().slice(0, 10)));
    return;
  }
  if (path === '/llms.txt' || path === '/docs/llms.txt') {
    md(LLMS_TXT.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (path === '/index.md' || path === '/article-1.md' || path === '/pricing.md') {
    md(MARKDOWN_PAGE);
    return;
  }
  if (path === '/AGENTS.md') {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end('# AGENTS.md\n\nHow coding agents should use the fixture product: read /docs, call the API.\n');
    return;
  }
  if (path === '/pricing' || path === '/about' || path === '/contact' || path === '/privacy' || path === '/terms' || path === '/developers') {
    html(`<!doctype html><html><head><title>${path.slice(1)}</title></head><body><main><h1>${path.slice(1)}</h1><p>Fixture ${path.slice(1)} page with real content. Pricing is $10 per month with a free tier. Contact us any time for support or integration help.</p></main></body></html>`);
    return;
  }
  if (path === '/.well-known/security.txt') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Contact: mailto:security@example.com\nExpires: 2999-01-01T00:00:00Z\n');
    return;
  }
  if (path === '/auth.md') {
    md(AUTH_MD.replaceAll('%BASE_URL%', baseUrl));
    return;
  }
  if (path === '/.well-known/agent.json') {
    json(AGENT_JSON);
    return;
  }
  if (path === '/.well-known/ai-plugin.json') {
    json(AI_PLUGIN);
    return;
  }
  if (path === '/.well-known/ard.json') {
    json(ardCatalogDoc(baseUrl));
    return;
  }
  if (path === '/.well-known/ai-catalog.json') {
    json(aiCatalogDoc(baseUrl));
    return;
  }
  if (path === '/.well-known/feeds.json') {
    json({ feeds: [{ url: `${baseUrl}/feed/products`, type: 'Product' }] });
    return;
  }
  if (path === '/.well-known/poppy.json') {
    json(poppyDoc(baseUrl));
    return;
  }
  if (path === '/.well-known/agent-skills/index.json') {
    json(AGENT_SKILLS);
    return;
  }
  if (path === '/.well-known/agent-skills/search/SKILL.md') {
    md(SKILL_MD);
    return;
  }
  if (path === '/.well-known/agent-card.json') {
    json(A2A_CARD);
    return;
  }
  if (path === '/.well-known/api-catalog') {
    res.writeHead(200, { 'content-type': 'application/linkset+json' });
    res.end(JSON.stringify(API_CATALOG));
    return;
  }
  if (path === '/.well-known/oauth-authorization-server') {
    json(oauthAs(baseUrl));
    return;
  }
  if (path === '/.well-known/oauth-protected-resource') {
    json(OAUTH_PR);
    return;
  }
  if (path === '/.well-known/mcp/server-card.json') {
    json(MCP_CARD);
    return;
  }
  if (path === '/.well-known/mcp.json') {
    json({ servers: [{ url: `${baseUrl}/mcp` }] });
    return;
  }
  if (path === '/.well-known/http-message-signatures-directory') {
    json(WEB_BOT_AUTH);
    return;
  }
  if (path === '/api/v1/openapi.json') {
    json(openapiDoc(baseUrl));
    return;
  }
  if (path === '/api/v1/items' || path.startsWith('/api/v1/items/') || path.startsWith('/api/v1/jobs/') || path === '/api/v1/batch') {
    json({ items: [], cursor: null }, 200, { 'ratelimit-limit': '100', 'ratelimit-remaining': '99' });
    return;
  }
  if (path.startsWith('/api/')) {
    json({ code: 'not_found', message: 'Resource not found' }, 404);
    return;
  }
  if (path === '/ask' || path === '/api/ask') {
    if (req.method === 'POST') {
      if (/text\/event-stream/i.test(accept)) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('data: {"results":[]}\n\n');
      } else {
        json({ results: [], query_id: 'agent-readiness-probe' });
      }
      return;
    }
    res.writeHead(405).end();
    return;
  }
  if (path === '/poppy/conversations' || path === '/poppy/browser-session' || path === '/poppy/operations') {
    json({ code: 'unauthenticated', message: 'PAP endpoint requires a session' }, 401);
    return;
  }
  if (path === '/agent/identity' || path === '/agent/identity/claim' || path === '/agent/event/notify' || path === '/oauth/token' || path === '/oauth/revoke' || path === '/oauth/authorize') {
    json({ ok: true });
    return;
  }
  if (path === '/checkout_sessions' || path === '/agentic_commerce/delegate_payment') {
    json({ code: 'invalid_request', message: 'missing fields' }, 422);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/markdown' });
  res.end('# Not found\n\nThe requested page does not exist. See /docs for the index.\n');
}

function spaFallthroughHandler(_req: IncomingMessage, res: ServerResponse): void {
  const ua = _req.headers['user-agent'] ?? '';
  if (/GPTBot|ClaudeBot|PerplexityBot|Googlebot|ChatGPT-User|OAI-SearchBot|Claude-User|Perplexity-User/i.test(ua)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html', 'x-robots-tag': 'noindex' });
  res.end('<!doctype html><html><body><div id="root"></div><script>if(!location.hash)location.replace("/app")</script></body></html>');
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

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect } from 'bun:test';

import mcpServerCard from '../../src/checks/mcp-server-card';
import { createHttpClient } from '../../src/http';
import { createTarget } from '../../src/target';

interface Fixture {
  url: string;
  close: () => Promise<void>;
}

function startFixture(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<Fixture> {
  return new Promise((resolveP) => {
    const server: Server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolveP({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function serveCard(body: unknown, contentType: string) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/.well-known/mcp/server-card.json') {
      res.writeHead(200, { 'content-type': contentType });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    } else {
      res.writeHead(404);
      res.end();
    }
  };
}

const http = createHttpClient({
  timeoutMs: 5000,
  userAgent: 'agent-readiness-test/0.0.1',
  defaultHeaders: {},
  insecure: false,
});

describe('mcp-server-card check', () => {
  it('passes for v1.json format (protocolVersion + serverInfo + transport)', async () => {
    const card = {
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'test-server', version: '1.0.0' },
      transport: { type: 'streamable-http', endpoint: '/mcp' },
    };
    const fixture = await startFixture(serveCard(card, 'application/json'));
    try {
      const target = createTarget({ url: fixture.url });
      const result = await mcpServerCard.run(target, http);
      expect(result.status).toBe('pass');
      expect(result.message).toMatch(/v1\.json/);
    } finally {
      await fixture.close();
    }
  });

  it('passes for SEP-1649 / server-card-v1 (no protocolVersion, serverInfo + transport + capabilities)', async () => {
    const card = {
      $schema: 'https://modelcontextprotocol.io/schemas/server-card-v1',
      serverInfo: { name: 'matzarich', version: '1.0.0' },
      transport: { type: 'streamable-http', endpoint: 'https://example.com/mcp' },
      capabilities: { tools: { listChanged: false } },
      auth: { type: 'oauth2', metadata: '/.well-known/oauth-authorization-server' },
    };
    const fixture = await startFixture(serveCard(card, 'application/json'));
    try {
      const target = createTarget({ url: fixture.url });
      const result = await mcpServerCard.run(target, http);
      expect(result.status).toBe('pass');
      expect(result.message).toMatch(/SEP-1649/);
    } finally {
      await fixture.close();
    }
  });

  it('fails when transport is missing', async () => {
    const card = { serverInfo: { name: 'test', version: '1.0' } };
    const fixture = await startFixture(serveCard(card, 'application/json'));
    try {
      const target = createTarget({ url: fixture.url });
      const result = await mcpServerCard.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/transport/);
    } finally {
      await fixture.close();
    }
  });

  it('fails when serverInfo.name is missing', async () => {
    const card = { transport: { type: 'http' }, serverInfo: { version: '1.0' } };
    const fixture = await startFixture(serveCard(card, 'application/json'));
    try {
      const target = createTarget({ url: fixture.url });
      const result = await mcpServerCard.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/serverInfo\.name/);
    } finally {
      await fixture.close();
    }
  });

  it('fails for SPA fallthrough (200 + text/html)', async () => {
    const fixture = await startFixture(serveCard('<!doctype html>...', 'text/html'));
    try {
      const target = createTarget({ url: fixture.url });
      const result = await mcpServerCard.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/content-type/);
    } finally {
      await fixture.close();
    }
  });
});

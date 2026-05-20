import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { describe, it, expect } from 'bun:test';

import robotsTxt from '../../src/checks/robots-txt';
import { createHttpClient } from '../../src/http';
import { createTarget } from '../../src/target';

const HERE = import.meta.dir;

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

const http = createHttpClient({
  timeoutMs: 5000,
  userAgent: 'agent-readiness-test/0.0.1',
  defaultHeaders: {},
  insecure: false,
});

describe('robots-txt check', () => {
  it('passes when robots.txt is served as text/plain with User-agent groups', async () => {
    const body = readFileSync(resolve(HERE, '../../testdata/robots-txt/pass/robots.txt'));
    const fixture = await startFixture((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(body);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      const target = createTarget({ url: fixture.url });
      const result = await robotsTxt.run(target, http);
      expect(result.status).toBe('pass');
      expect(result.message).toMatch(/User-agent group/);
    } finally {
      await fixture.close();
    }
  });

  it('fails when /robots.txt returns 404', async () => {
    const fixture = await startFixture((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    try {
      const target = createTarget({ url: fixture.url });
      const result = await robotsTxt.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/HTTP 404/);
    } finally {
      await fixture.close();
    }
  });

  it('fails when server returns 200 + text/html (SPA fallthrough, the F1 defense)', async () => {
    const fixture = await startFixture((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body><div id="root"></div></body></html>');
    });
    try {
      const target = createTarget({ url: fixture.url });
      const result = await robotsTxt.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/content-type/);
    } finally {
      await fixture.close();
    }
  });

  it('fails when 200 + text/plain but body lacks User-agent: directive', async () => {
    const fixture = await startFixture((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('# just a comment, no rules\n');
    });
    try {
      const target = createTarget({ url: fixture.url });
      const result = await robotsTxt.run(target, http);
      expect(result.status).toBe('fail');
      expect(result.message).toMatch(/User-agent/);
    } finally {
      await fixture.close();
    }
  });
});

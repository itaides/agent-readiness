import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'bun:test';

import pageHtmlQuality from '../src/checks/page-html-quality';
import { crawlPages } from '../src/crawl';
import { createHttpClient } from '../src/http';
import { createTarget } from '../src/target';

// Two servers on different ports are different origins: one plays the scan target, the other a
// host the target links or redirects to.
interface Host {
  url: string;
  requests: IncomingMessage[];
  close: () => Promise<void>;
}

const open: Host[] = [];

function startHost(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<Host> {
  return new Promise((resolve) => {
    const requests: IncomingMessage[] = [];
    const server: Server = createServer((req, res) => { requests.push(req); handler(req, res); });
    server.listen(0, '127.0.0.1', () => {
      const host = {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        requests,
        close: () => new Promise<void>((r) => server.close(() => r())),
      };
      open.push(host);
      resolve(host);
    });
  });
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((h) => h.close()));
});

const PAGE = '<!doctype html><html lang="en"><head><title>t</title></head><body><h1>Hello</h1><p>Plenty of readable text for the ratio check.</p></body></html>';

function client(targetUrl: string) {
  return createHttpClient({
    timeoutMs: 5000,
    userAgent: 'agent-readiness-test',
    defaultHeaders: { Cookie: 'session=secret', Authorization: 'Bearer secret' },
    credentialOrigin: new URL(targetUrl).origin,
    insecure: false,
  });
}

describe('credential scope', () => {
  it('sends --cookie and --header values to the target but not across a redirect to another origin', async () => {
    const other = await startHost((_req, res) => { res.writeHead(200); res.end('ok'); });
    const target = await startHost((_req, res) => { res.writeHead(302, { Location: `${other.url}/landing` }); res.end(); });

    const res = await client(target.url).fetch(`${target.url}/`);
    expect(res.status).toBe(200);
    expect(target.requests[0].headers.cookie).toBe('session=secret');
    expect(target.requests[0].headers.authorization).toBe('Bearer secret');
    expect(other.requests[0].headers.cookie).toBeUndefined();
    expect(other.requests[0].headers.authorization).toBeUndefined();
    expect(other.requests[0].headers['user-agent']).toBe('agent-readiness-test');
  });

  it('crawls only sitemap pages on the target origin', async () => {
    const other = await startHost((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PAGE); });
    const target = await startHost((req, res) => {
      if (req.url === '/sitemap.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(`<?xml version="1.0"?><urlset><url><loc>${target.url}/a</loc></url><url><loc>${other.url}/b</loc></url></urlset>`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    });

    const crawl = await crawlPages(createTarget({ url: target.url }), [pageHtmlQuality], client(target.url), 5);
    expect(crawl?.pages).toEqual([`${target.url}/a`]);
    expect(other.requests).toHaveLength(0);
  });
});

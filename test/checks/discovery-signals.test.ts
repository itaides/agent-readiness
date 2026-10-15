import { describe, expect, it } from 'bun:test';
import agentsTxt from '../../src/checks/agents-txt';
import rssAtom from '../../src/checks/rss-atom';
import sitemapLastmod from '../../src/checks/sitemap-lastmod';
import tdmrep from '../../src/checks/tdmrep';
import type { HttpResponse } from '../../src/types';
import { client, response, target } from './_helpers';

/** A client serving the given paths on https://example.com and 404 elsewhere. */
function site(routes: Record<string, HttpResponse>) {
  return client((url) => routes[new URL(url).pathname] ?? response(404, '', 'text/plain'));
}

function sitemap(total: number, withLastmod: number): string {
  const urls = Array.from({ length: total }, (_, i) =>
    `<url><loc>https://example.com/p${i}</loc>${i < withLastmod ? '<lastmod>2026-10-01</lastmod>' : ''}</url>`);
  return `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}

describe('sitemap-lastmod', () => {
  it('passes at exactly 80% coverage', async () => {
    const result = await sitemapLastmod.run(target, site({ '/sitemap.xml': response(200, sitemap(5, 4), 'application/xml') }));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('4/5 URLs carry lastmod (80%)');
  });
  it('warns just below 80%', async () => {
    const result = await sitemapLastmod.run(target, site({ '/sitemap.xml': response(200, sitemap(10, 7), 'application/xml') }));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Only 7/10');
  });
  it('warns at 79.5%, which must not round up to a pass', async () => {
    const result = await sitemapLastmod.run(target, site({ '/sitemap.xml': response(200, sitemap(200, 159), 'application/xml') }));
    expect(result.status).toBe('warn');
  });
  it('follows the Sitemap directive in robots.txt', async () => {
    const http = site({
      '/robots.txt': response(200, 'User-agent: *\nSitemap: https://example.com/maps/main.xml\n', 'text/plain'),
      '/maps/main.xml': response(200, sitemap(2, 2), 'application/xml'),
    });
    const result = await sitemapLastmod.run(target, http);
    expect(result.status).toBe('pass');
    expect(result.evidence.request?.url).toBe('https://example.com/maps/main.xml');
  });
  it('warns when there is no sitemap', async () => {
    expect((await sitemapLastmod.run(target, site({}))).message).toBe('No sitemap to inspect for lastmod coverage');
  });
  it('warns on a sitemap index or an SPA fallthrough without <url> entries', async () => {
    const index = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>';
    expect((await sitemapLastmod.run(target, site({ '/sitemap.xml': response(200, index, 'application/xml') }))).message).toContain('index or has no <url>');
    expect((await sitemapLastmod.run(target, site({ '/sitemap.xml': response(200, '<html></html>', 'text/html') }))).status).toBe('warn');
  });
});

describe('rss-atom', () => {
  const RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title></channel></rss>';
  it('passes on a feed advertised with a <link> tag', async () => {
    const http = site({
      '/docs': response(200, '<link rel="alternate" type="application/rss+xml" href="/feed.xml">'),
      '/feed.xml': response(200, RSS, 'application/rss+xml'),
    });
    const result = await rssAtom.run(target, http);
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Valid feed at /feed.xml');
  });
  it('passes on an Atom feed advertised in a Link header', async () => {
    const http = site({
      '/docs': response(200, '<p>x</p>', 'text/html', { link: '</atom.xml>; rel="alternate"; type="application/atom+xml"' }),
      '/atom.xml': response(200, '<feed xmlns="http://www.w3.org/2005/Atom"></feed>', 'application/atom+xml'),
    });
    expect((await rssAtom.run(target, http)).message).toBe('Valid feed at /atom.xml');
  });
  it('warns when the advertised feed is not XML (SPA fallthrough)', async () => {
    const http = site({
      '/docs': response(200, '<link rel="alternate" type="application/rss+xml" href="/feed.xml">'),
      '/feed.xml': response(200, '<!doctype html><div id="root"></div>', 'text/html'),
    });
    expect((await rssAtom.run(target, http)).status).toBe('warn');
  });
  it('warns when the advertised feed is missing', async () => {
    const http = site({ '/docs': response(200, '<link rel="alternate" type="application/atom+xml" href="/atom.xml">') });
    expect((await rssAtom.run(target, http)).status).toBe('warn');
  });
  it('warns when no feed is advertised', async () => {
    const result = await rssAtom.run(target, site({ '/docs': response(200, '<p>no feed</p>') }));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No RSS/Atom feed advertised');
  });
});

describe('agents-txt', () => {
  it('passes on /agents.json and prefers it over /agents.txt', async () => {
    const http = site({
      '/agents.json': response(200, JSON.stringify({ name: 'x', mcp: {} }), 'application/json'),
      '/agents.txt': response(200, '# MCP\nhttps://example.com/mcp', 'text/plain'),
    });
    const result = await agentsTxt.run(target, http);
    expect(result.status).toBe('pass');
    expect(result.message).toBe('/agents.json capability declaration (2 top-level keys)');
  });
  it('passes on /agents.txt and counts capability blocks', async () => {
    const http = site({ '/agents.txt': response(200, '# Agents\n## MCP\nurl\n## Auth\noauth\n', 'text/plain') });
    expect((await agentsTxt.run(target, http)).message).toBe('/agents.txt found (2 capability block(s))');
  });
  it('falls back to /agents.txt when /agents.json is an SPA fallthrough or invalid JSON', async () => {
    const txt = response(200, 'capabilities: none yet', 'text/plain');
    for (const json of [response(200, '<html></html>', 'text/html'), response(200, '{not json', 'application/json')]) {
      expect((await agentsTxt.run(target, site({ '/agents.json': json, '/agents.txt': txt }))).message).toBe('/agents.txt found');
    }
  });
  it('warns when /agents.txt is an SPA fallthrough or empty', async () => {
    expect((await agentsTxt.run(target, site({ '/agents.txt': response(200, '<html></html>', 'text/html') }))).status).toBe('warn');
    expect((await agentsTxt.run(target, site({ '/agents.txt': response(200, '  \n', 'text/plain') }))).status).toBe('warn');
  });
  it('warns when neither exists', async () => {
    expect((await agentsTxt.run(target, site({}))).message).toContain('No agents.txt or agents.json');
  });
});

describe('tdmrep', () => {
  it('passes on a TDM-Reservation header on the content page', async () => {
    const http = site({ '/docs': response(200, '<p>x</p>', 'text/html', { 'tdm-reservation': '1' }) });
    expect((await tdmrep.run(target, http)).message).toBe('TDM policy signals: TDM-Reservation: 1');
  });
  it('passes on a tdm-reservation meta tag', async () => {
    const http = site({ '/docs': response(200, '<meta name="tdm-reservation" content="1">') });
    expect((await tdmrep.run(target, http)).message).toContain('<meta tdm-reservation>');
  });
  it('passes on /.well-known/tdmrep.json and /ai.txt', async () => {
    const http = site({
      '/.well-known/tdmrep.json': response(200, '[{"location":"/*","tdm-reservation":0}]', 'application/json'),
      '/ai.txt': response(200, 'User-Agent: *\nDisallow: /private', 'text/plain'),
    });
    expect((await tdmrep.run(target, http)).message).toBe('TDM policy signals: /.well-known/tdmrep.json, /ai.txt');
  });
  it('ignores SPA fallthroughs for tdmrep.json and ai.txt served as HTML', async () => {
    const html = response(200, '<!doctype html><div id="root"></div>', 'text/html');
    const result = await tdmrep.run(target, site({ '/docs': response(200, '<p>x</p>'), '/.well-known/tdmrep.json': html, '/ai.txt': html }));
    expect(result.status).toBe('warn');
  });
  it('ignores an empty ai.txt', async () => {
    expect((await tdmrep.run(target, site({ '/ai.txt': response(200, '\n', 'text/plain') }))).status).toBe('warn');
  });
  it('warns when no signal exists', async () => {
    expect((await tdmrep.run(target, site({}))).message).toContain('No TDMRep or ai.txt policy signal');
  });
});

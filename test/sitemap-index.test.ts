import { describe, expect, it } from 'bun:test';

import pageHtmlQuality from '../src/checks/page-html-quality';
import { MAX_CHILD_SITEMAPS, loadSitemap } from '../src/checks/_sitemap';
import { crawlPages } from '../src/crawl';
import { client, GOOD_HTML, response, target } from './checks/_helpers';

const page = (n: number) => `<url><loc>https://example.com/p${n}</loc></url>`;
const urlset = (...pages: number[]) => `<?xml version="1.0"?><urlset>${pages.map(page).join('')}</urlset>`;
const index = (...locs: string[]) => `<?xml version="1.0"?><sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`;

describe('loadSitemap', () => {
  it('reads a plain sitemap discovered from robots.txt', async () => {
    const http = client((url) => {
      const path = new URL(url).pathname;
      if (path === '/robots.txt') return response(200, 'User-agent: *\nSitemap: https://example.com/pages.xml\n', 'text/plain');
      if (path === '/pages.xml') return response(200, urlset(1, 2), 'application/xml');
      return response(404, '');
    });
    const sitemap = await loadSitemap(target, http);
    expect(sitemap.isIndex).toBe(false);
    expect(sitemap.entries.map((e) => e.loc)).toEqual(['https://example.com/p1', 'https://example.com/p2']);
  });

  it('reads same-origin children of an index and never fetches other origins', async () => {
    const fetched: string[] = [];
    const http = client((url) => {
      fetched.push(url);
      const path = new URL(url).pathname;
      if (path === '/sitemap.xml') return response(200, index('https://example.com/a.xml', 'https://other.example/b.xml'), 'application/xml');
      if (path === '/a.xml') return response(200, urlset(1), 'application/xml');
      return response(404, '');
    });
    const sitemap = await loadSitemap(target, http);
    expect(sitemap.isIndex).toBe(true);
    expect(sitemap.children).toEqual(['https://example.com/a.xml']);
    expect(sitemap.skippedChildren).toBe(1);
    expect(sitemap.entries.map((e) => e.loc)).toEqual(['https://example.com/p1']);
    expect(fetched.some((u) => u.includes('other.example'))).toBe(false);
  });

  it(`reads at most ${MAX_CHILD_SITEMAPS} children`, async () => {
    const children = Array.from({ length: MAX_CHILD_SITEMAPS + 5 }, (_, i) => `https://example.com/s${i}.xml`);
    let childFetches = 0;
    const http = client((url) => {
      const path = new URL(url).pathname;
      if (path === '/sitemap.xml') return response(200, index(...children), 'application/xml');
      childFetches++;
      return response(200, urlset(childFetches), 'application/xml');
    });
    const sitemap = await loadSitemap(target, http);
    expect(childFetches).toBe(MAX_CHILD_SITEMAPS);
    expect(sitemap.skippedChildren).toBe(5);
    expect(sitemap.evidence.note).toBe(`Sitemap index: read ${MAX_CHILD_SITEMAPS} of ${MAX_CHILD_SITEMAPS + 5} listed sitemap(s)`);
  });
});

describe('--crawl with a sitemap index', () => {
  it('samples pages from the child sitemaps, not the sitemap files', async () => {
    const http = client((url) => {
      const path = new URL(url).pathname;
      if (path === '/sitemap.xml') return response(200, index('https://example.com/s1.xml'), 'application/xml');
      if (path === '/s1.xml') return response(200, urlset(1, 2), 'application/xml');
      return response(200, GOOD_HTML);
    });
    const crawl = await crawlPages(target, [pageHtmlQuality], http, 5);
    expect(crawl?.pages).toEqual(['https://example.com/p1', 'https://example.com/p2']);
    expect(crawl?.perCheck['page-html-quality'].fail).toBe(0);
  });
});

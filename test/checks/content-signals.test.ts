import { describe, expect, it } from 'bun:test';
import freshnessSignals from '../../src/checks/freshness-signals';
import llmsFullTxt from '../../src/checks/llms-full-txt';
import markdownLinkRel from '../../src/checks/markdown-link-rel';
import semanticControls from '../../src/checks/semantic-controls';
import sitemapMd from '../../src/checks/sitemap-md';
import { client, response, target } from './_helpers';

// The content page is https://example.com/docs (see _helpers). Page checks share one fetch per client,
// so every test builds its own client.
const page = (html: string, headers: Record<string, string> = {}) =>
  client((url) => url === 'https://example.com/docs' ? response(200, html, 'text/html', headers) : response(404, '', 'text/plain'));

describe('freshness-signals', () => {
  it('passes on JSON-LD dateModified', async () => {
    const html = '<html><script type="application/ld+json">{"@type":"Article","dateModified":"2026-10-01"}</script></html>';
    const result = await freshnessSignals.run(target, page(html));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('dateModified=2026-10-01');
  });
  it('passes on nested JSON-LD datePublished', async () => {
    const html = '<script type="application/ld+json">{"@graph":[{"@type":"BlogPosting","datePublished":"2026-09-30"}]}</script>';
    expect((await freshnessSignals.run(target, page(html))).message).toContain('datePublished=2026-09-30');
  });
  it('passes on a <time datetime> element', async () => {
    const result = await freshnessSignals.run(target, page('<p>Updated <time datetime="2026-10-01">Oct 1</time></p>'));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('<time datetime>');
  });
  it('passes on article meta time', async () => {
    const html = '<meta property="article:modified_time" content="2026-10-01T10:00:00Z">';
    expect((await freshnessSignals.run(target, page(html))).message).toContain('article:modified_time=2026-10-01T10:00:00Z');
  });
  it('passes on a Last-Modified header alone', async () => {
    const result = await freshnessSignals.run(target, page('<p>plain</p>', { 'last-modified': 'Wed, 01 Oct 2026 10:00:00 GMT' }));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Last-Modified: Wed, 01 Oct 2026');
  });
  it('warns when no signal exists', async () => {
    const result = await freshnessSignals.run(target, page('<p>timeless</p>'));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No freshness signals');
  });
  it('ignores unparseable JSON-LD', async () => {
    const html = '<script type="application/ld+json">{"dateModified": "2026-10-01",}</script>';
    expect((await freshnessSignals.run(target, page(html))).status).toBe('warn');
  });
  it('warns when the page is missing or not HTML', async () => {
    expect((await freshnessSignals.run(target, client(() => response(404, '', 'text/html')))).message).toContain('HTTP 404');
    const json = client(() => response(200, '{"dateModified":"2026-10-01"}', 'application/json'));
    expect((await freshnessSignals.run(target, json)).message).toContain('is not text/html');
  });
});

describe('semantic-controls', () => {
  it('passes on real links and buttons', async () => {
    const html = '<a href="/a">Pricing</a><a href="/b">Docs</a><button>Sign up</button><input type="email" aria-label="Email">';
    const result = await semanticControls.run(target, page(html));
    expect(result.status).toBe('pass');
    expect(result.message).toBe('2 links, 1 buttons — all semantic');
  });
  it('warns on click handlers on divs and spans', async () => {
    const html = '<a href="/a">Docs</a><div onclick="go()">Buy</div><span onclick="x()">Menu</span>';
    const result = await semanticControls.run(target, page(html));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('2 non-semantic click handler(s)');
  });
  it('warns on unlabelled inputs but not hidden or submit inputs', async () => {
    const html = '<a href="/a">Docs</a><input type="text"><input type="hidden" value="x"><input type="submit" value="Go">';
    const result = await semanticControls.run(target, page(html));
    expect(result.status).toBe('warn');
    expect(result.message).toBe('1 unlabelled input(s)');
  });
  it('warns when most links have generic text', async () => {
    const html = ['click here', 'read more', 'here', 'Pricing'].map((t, i) => `<a href="/${i}">${t}</a>`).join('');
    expect((await semanticControls.run(target, page(html))).message).toContain('3/4 links use generic text');
  });
  it('tolerates generic text below four links', async () => {
    const html = '<a href="/a">click here</a><a href="/b">here</a><a href="/c">more</a>';
    expect((await semanticControls.run(target, page(html))).status).toBe('pass');
  });
  it('warns when there are no semantic controls at all', async () => {
    const result = await semanticControls.run(target, page('<div id="root"></div>'));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('may be JS-rendered only');
  });
  it('warns when the page is missing or not HTML', async () => {
    expect((await semanticControls.run(target, client(() => response(500, '', 'text/html')))).message).toContain('HTTP 500');
    expect((await semanticControls.run(target, client(() => response(200, '# md', 'text/markdown')))).message).toContain('is not text/html');
  });
});

describe('markdown-link-rel', () => {
  it('passes on a Link header with rel=alternate type=text/markdown', async () => {
    const result = await markdownLinkRel.run(target, page('<p>x</p>', { link: '</docs.md>; rel="alternate"; type="text/markdown"' }));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Link rel=alternate type=text/markdown');
  });
  it('passes on a <link rel=alternate type=text/markdown> tag', async () => {
    const result = await markdownLinkRel.run(target, page('<link rel="alternate" type="text/markdown" href="/docs.md">'));
    expect(result.message).toContain('<link rel=alternate type=text/markdown>');
  });
  it('passes on rel=describedby in the header or a tag', async () => {
    expect((await markdownLinkRel.run(target, page('', { link: '</llms.txt>; rel="describedby"' }))).message).toContain('Link rel=describedby');
    expect((await markdownLinkRel.run(target, page('<link rel="describedby" href="/llms.txt">'))).message).toContain('<link rel=describedby>');
  });
  it('ignores alternates that are not markdown', async () => {
    const html = '<link rel="alternate" type="application/rss+xml" href="/feed.xml">';
    const result = await markdownLinkRel.run(target, page(html, { link: '</de/docs>; rel="alternate"; hreflang="de"' }));
    expect(result.status).toBe('warn');
  });
  it('warns when the page is missing', async () => {
    expect((await markdownLinkRel.run(target, client(() => response(404, '', 'text/html')))).message).toContain('HTTP 404');
  });
});

describe('llms-full-txt', () => {
  const at = (res: ReturnType<typeof response>) => client((url) => url === 'https://example.com/llms-full.txt' ? res : response(404, '', 'text/plain'));
  it('passes on non-empty text/plain or text/markdown', async () => {
    expect((await llmsFullTxt.run(target, at(response(200, '# Site\nAll docs', 'text/plain; charset=utf-8')))).status).toBe('pass');
    expect((await llmsFullTxt.run(target, at(response(200, '# Site', 'text/markdown')))).status).toBe('pass');
  });
  it('fails when absent', async () => {
    expect((await llmsFullTxt.run(target, at(response(404, '', 'text/plain')))).message).toBe('Not found (HTTP 404)');
  });
  it('fails on an SPA fallthrough', async () => {
    const result = await llmsFullTxt.run(target, at(response(200, '<!doctype html><div id="root">', 'text/html')));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('is not text/plain or text/markdown');
  });
  it('fails on an empty body', async () => {
    expect((await llmsFullTxt.run(target, at(response(200, '', 'text/plain')))).message).toBe('Empty body');
  });
});

describe('sitemap-md', () => {
  const at = (res: ReturnType<typeof response>) => client((url) => url === 'https://example.com/sitemap.md' ? res : response(404, '', 'text/plain'));
  it('passes on markdown with links', async () => {
    const result = await sitemapMd.run(target, at(response(200, '# Map\n- [Home](/)\n- [Docs](/docs)\n', 'text/markdown')));
    expect(result.status).toBe('pass');
    expect(result.message).toBe('sitemap.md with 2 links');
  });
  it('warns when absent', async () => {
    expect((await sitemapMd.run(target, at(response(404, '', 'text/plain')))).message).toContain('Not found (HTTP 404)');
  });
  it('warns on an SPA fallthrough', async () => {
    expect((await sitemapMd.run(target, at(response(200, '<html></html>', 'text/html')))).message).toContain('is not markdown');
  });
  it('warns when it has no markdown links', async () => {
    const result = await sitemapMd.run(target, at(response(200, '# Map\n- Home: /\n- https://example.com/docs\n', 'text/plain')));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no markdown links');
  });
});

import { describe, expect, it } from 'bun:test';
import pageHtmlQuality from '../../src/checks/page-html-quality';
import jsonLd from '../../src/checks/json-ld';
import { client, GOOD_HTML, response, target } from './_helpers';

describe('page-html-quality', () => {
  it('passes a well-formed readable page', async () => {
    const http = client(() => response(200, GOOD_HTML));
    expect((await pageHtmlQuality.run(target, http)).status).toBe('pass');
  });
  it('fails an empty SPA shell', async () => {
    const shell = `<html><body><div id="app"></div><script>${'x'.repeat(2000)}</script></body></html>`;
    const result = await pageHtmlQuality.run(target, client(() => response(200, shell)));
    expect(result.status).toBe('fail');
  });
  it('warns when readable but missing head metadata', async () => {
    const thin = `<html><body><h1>T</h1><h2>A</h2><h2>B</h2><p>${'text '.repeat(300)}</p></body></html>`;
    const result = await pageHtmlQuality.run(target, client(() => response(200, thin)));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('canonical');
  });
});

describe('json-ld', () => {
  it('passes with a valid typed block', async () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Organization","name":"X"}</script></head></html>`;
    expect((await jsonLd.run(target, client(() => response(200, html)))).status).toBe('pass');
  });
  it('fails when no JSON-LD exists', async () => {
    expect((await jsonLd.run(target, client(() => response(200, '<html></html>')))).status).toBe('fail');
  });
  it('fails when ld+json blocks are unparseable', async () => {
    const html = `<script type="application/ld+json">{broken</script>`;
    expect((await jsonLd.run(target, client(() => response(200, html)))).status).toBe('fail');
  });
  it('warns when only microdata exists', async () => {
    const html = `<div itemscope itemtype="https://schema.org/Thing"></div>`;
    expect((await jsonLd.run(target, client(() => response(200, html)))).status).toBe('warn');
  });
});

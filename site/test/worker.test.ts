import { describe, expect, it } from 'bun:test';

import worker, { acceptsMarkdown } from '../src/worker';

const ASSETS = {
  async fetch(request: Request | string): Promise<Response> {
    const path = new URL(typeof request === 'string' ? request : request.url).pathname;
    if (path === '/index.md') return new Response('# md', { headers: { 'Content-Type': 'text/markdown' } });
    if (path === '/') return new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });
    return new Response('not found', { status: 404 });
  },
};

const get = (path: string, accept?: string) =>
  worker.fetch(new Request(`https://site.test${path}`, { headers: accept ? { Accept: accept } : {} }), { ASSETS });

describe('acceptsMarkdown', () => {
  it('honours text/markdown unless its quality is zero', () => {
    expect(acceptsMarkdown('text/markdown')).toBe(true);
    expect(acceptsMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
    expect(acceptsMarkdown('text/html, text/markdown;q=0')).toBe(false);
    expect(acceptsMarkdown('text/html,application/xhtml+xml,*/*;q=0.8')).toBe(false);
    expect(acceptsMarkdown(null)).toBe(false);
  });
});

describe('site worker', () => {
  it('serves the Markdown version for Accept: text/markdown', async () => {
    const res = await get('/', 'text/markdown');
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toBe('# md');
  });

  it('serves HTML to browsers and still advertises the Markdown version', async () => {
    const res = await get('/', 'text/html');
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(res.headers.get('Link')).toBe('</index.md>; rel="alternate"; type="text/markdown"');
  });

  it('passes other paths straight to static assets', async () => {
    const res = await get('/nope', 'text/markdown');
    expect(res.status).toBe(404);
    expect(res.headers.get('Vary')).toBeNull();
  });
});

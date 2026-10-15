import { describe, expect, it } from 'bun:test';
import markdownMirror from '../../src/checks/markdown-mirror';
import markdownNegotiation from '../../src/checks/markdown-negotiation';
import { client, GOOD_HTML, response, target } from './_helpers';

describe('markdown-mirror', () => {
  it('passes when <path>.md returns markdown', async () => {
    const http = client((url) => url.endsWith('/docs.md')
      ? response(200, '# Docs\n\nContent', 'text/markdown')
      : response(404, '', 'text/plain'));
    expect((await markdownMirror.run(target, http)).status).toBe('pass');
  });
  it('fails when no mirror exists', async () => {
    const http = client(() => response(404, '', 'text/plain'));
    expect((await markdownMirror.run(target, http)).status).toBe('fail');
  });
  it('uses a Link-advertised mirror', async () => {
    const http = client((url, init) => {
      if (url === 'https://example.com/docs') {
        return response(200, GOOD_HTML, 'text/html', { link: '</docs/markdown>; rel="alternate"; type="text/markdown"' });
      }
      if (url === 'https://example.com/docs/markdown') return response(200, '# Docs', 'text/markdown');
      return response(404, '', 'text/plain');
    });
    expect((await markdownMirror.run(target, http)).status).toBe('pass');
  });
});

describe('markdown-negotiation vary', () => {
  it('warns when markdown lacks Vary: Accept', async () => {
    const http = client(() => response(200, '# Doc', 'text/markdown'));
    expect((await markdownNegotiation.run(target, http)).status).toBe('warn');
  });
  it('passes with Vary: Accept', async () => {
    const http = client(() => response(200, '# Doc', 'text/markdown', { vary: 'Accept' }));
    expect((await markdownNegotiation.run(target, http)).status).toBe('pass');
  });
});

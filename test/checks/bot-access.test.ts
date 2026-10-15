import { describe, expect, it } from 'bun:test';
import xRobotsTag from '../../src/checks/x-robots-tag';
import botUaDifferential from '../../src/checks/bot-ua-differential';
import { client, GOOD_HTML, response, target } from './_helpers';

describe('x-robots-tag', () => {
  it('passes with no header', async () => {
    expect((await xRobotsTag.run(target, client(() => response(200, GOOD_HTML)))).status).toBe('pass');
  });
  it('fails on noindex', async () => {
    const http = client(() => response(200, GOOD_HTML, 'text/html', { 'x-robots-tag': 'noindex' }));
    expect((await xRobotsTag.run(target, http)).status).toBe('fail');
  });
  it('fails on bot-scoped directive', async () => {
    const http = client(() => response(200, GOOD_HTML, 'text/html', { 'x-robots-tag': 'GPTBot: noindex' }));
    expect((await xRobotsTag.run(target, http)).status).toBe('fail');
  });
});

describe('bot-ua-differential', () => {
  it('passes when bots get the same 200', async () => {
    expect((await botUaDifferential.run(target, client(() => response(200, GOOD_HTML)))).status).toBe('pass');
  });
  it('fails when a bot UA is 403', async () => {
    const http = client((url, init) => init?.headers?.['User-Agent']?.startsWith('GPTBot')
      ? response(403, 'blocked', 'text/html')
      : response(200, GOOD_HTML));
    expect((await botUaDifferential.run(target, http)).status).toBe('fail');
  });

  const isBot = (init?: { headers?: Record<string, string> }) => /^(GPTBot|ClaudeBot)/.test(init?.headers?.['User-Agent'] ?? '');
  const MARKDOWN = `---\ntitle: Docs\n---\n\n# Docs\n\n${'Install the CLI and run a scan against your site. '.repeat(8)}`;

  it('passes when bots get a Markdown version of the HTML page', async () => {
    const http = client((_url, init) => (isBot(init) ? response(200, MARKDOWN, 'text/markdown; charset=utf-8') : response(200, GOOD_HTML)));
    const result = await botUaDifferential.run(target, http);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('AI bots get a Markdown version instead of HTML: GPTBot');
    expect(result.message).toContain('ClaudeBot');
  });

  it('warns when the Markdown bots get is too thin to stand in for the page', async () => {
    const http = client((_url, init) => (isBot(init) ? response(200, '# Docs', 'text/markdown') : response(200, GOOD_HTML)));
    const result = await botUaDifferential.run(target, http);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('% of browser body size');
  });

  it('still warns on a much smaller HTML response for bots', async () => {
    const http = client((_url, init) => (isBot(init) ? response(200, '<html><body>Please enable JavaScript</body></html>') : response(200, GOOD_HTML)));
    expect((await botUaDifferential.run(target, http)).status).toBe('warn');
  });

  it('fails on a block even when another bot gets Markdown', async () => {
    const http = client((_url, init) => {
      const ua = init?.headers?.['User-Agent'] ?? '';
      if (ua.startsWith('GPTBot')) return response(200, MARKDOWN, 'text/markdown');
      if (ua.startsWith('ClaudeBot')) return response(403, 'blocked');
      return response(200, GOOD_HTML);
    });
    expect((await botUaDifferential.run(target, http)).status).toBe('fail');
  });
});

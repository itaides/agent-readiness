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
});

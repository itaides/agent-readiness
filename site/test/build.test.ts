import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checks } from '../../src/registry';
import { buildSite } from '../src/build';

let dir: string;
const read = (path: string) => readFile(join(dir, path), 'utf8');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agent-readiness-site-'));
  await buildSite(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('site build', () => {
  it('writes every page and agent-facing file', async () => {
    for (const path of ['index.html', 'scan/index.html', 'example/index.html', 'example/report.json', '404.html', 'robots.txt', 'llms.txt']) {
      expect((await read(path)).length).toBeGreaterThan(0);
    }
  });

  it('pages load nothing from other origins', async () => {
    for (const path of ['index.html', 'scan/index.html', 'example/index.html', '404.html']) {
      const html = await read(path);
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/i);
      expect(html).not.toMatch(/<img\b/i);
      expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
    }
  });

  it('states the real check count and install command', async () => {
    const html = await read('index.html');
    expect(html).toContain(`against ${checks.length} checks`);
    expect(html).toContain('bun install -g github:itaides/agent-readiness');
    expect(await read('llms.txt')).toContain(`${checks.length} AI-agent readiness checks`);
  });

  it('builds the example from the real registry and keeps landing numbers in sync', async () => {
    const report = JSON.parse(await read('example/report.json'));
    expect(report.checks.map((c: { id: string }) => c.id).sort()).toEqual(checks.map((c) => c.id).sort());
    const landing = await read('index.html');
    expect(landing).toContain('data-n="75"');
    expect(landing).toContain('12 of 16 scored checks passing');
    expect(await read('example/index.html')).toContain('<progress value="75"');
  });

  it('only links to well-known paths the scanner actually checks', async () => {
    const landing = await read('index.html');
    expect(landing).toContain('/.well-known/mcp/server-card.json');
    expect(landing).not.toContain('/.well-known/mcp.json');
  });

  it('keeps the scan placeholder out of search and echoes URLs safely', async () => {
    const scan = await read('scan/index.html');
    expect(scan).toContain('<meta name="robots" content="noindex">');
    expect(scan).toContain(".textContent = cmd");
    expect(scan).not.toContain('innerHTML');
    expect(await read('robots.txt')).toContain('Disallow: /scan/');
  });
});

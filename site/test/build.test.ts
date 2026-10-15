import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { checks } from '../../src/registry';
import { resolveScore } from '../../src/report-html';
import { buildSite } from '../src/build';
import { SITE_URL } from '../src/config';
import { sampleReport } from '../src/sample-report';

let dir: string;
const read = (path: string) => readFile(join(dir, path), 'utf8');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agent-readiness-site-'));
  await buildSite(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('site build', () => {
  it('writes every page and agent-facing file', async () => {
    for (const path of [
      'index.html', 'index.md', 'scan/index.html', 'example/index.html', 'example/index.md', 'example/report.json', '404.html',
      'robots.txt', 'sitemap.xml', 'sitemap.md', 'llms.txt', 'llms-full.txt', 'AGENTS.md', '.well-known/tdmrep.json',
      '.well-known/agent-skills/index.json', '.well-known/agent-skills/agent-readiness/SKILL.md',
      'assets/site.css', 'assets/site.js', '_headers',
    ]) {
      expect((await read(path)).length).toBeGreaterThan(0);
    }
  });

  it('pages load nothing from other origins', async () => {
    for (const path of ['index.html', 'scan/index.html', 'example/index.html', '404.html']) {
      const html = await read(path);
      expect(html).not.toMatch(/<script[^>]+src="(https?:)?\/\//i);
      expect(html).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="(https?:)?\/\//i);
      expect(html).not.toMatch(/<img\b/i);
      expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
    }
  });

  it('states the real check count and install command', async () => {
    const html = await read('index.html');
    expect(html).toContain(`against ${checks.length} checks`);
    expect(html).toContain('npm install -g @itaides/agent-readiness');
    expect(html).not.toContain('github:itaides');
    expect(await read('llms.txt')).toContain(`${checks.length} AI-agent readiness checks`);
  });

  it('builds the example from the real registry and keeps landing numbers in sync', async () => {
    const report = JSON.parse(await read('example/report.json'));
    expect(report.checks.map((c: { id: string }) => c.id).sort()).toEqual(checks.map((c) => c.id).sort());
    const score = resolveScore(sampleReport());
    if (!score) throw new Error('sample report has no scored checks');
    const landing = await read('index.html');
    expect(landing).toContain(`data-n="${score.value}"`);
    expect(landing).toContain(`${score.passed} of ${score.total} scored checks passing`);
    expect(await read('example/index.html')).toContain(`<progress value="${score.value}"`);
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

  it('declares an explicit crawler policy that welcomes AI bots', async () => {
    const robots = await read('robots.txt');
    expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=yes');
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot']) {
      expect(robots).toContain(`User-agent: ${bot}\nAllow: /\nDisallow: /scan/`);
    }
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(await read('sitemap.xml')).toContain(`<loc>${SITE_URL}/</loc>`);
  });

  it('links each indexable page to its canonical URL and Markdown version', async () => {
    const landing = await read('index.html');
    expect(landing).toContain(`<link rel="canonical" href="${SITE_URL}/">`);
    expect(landing).toContain('<link rel="alternate" type="text/markdown" href="/index.md"');
    const ld = JSON.parse(landing.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    expect(ld['@type']).toBe('SoftwareApplication');
    expect(await read('scan/index.html')).not.toContain('rel="canonical"');
    expect(await read('index.md')).toContain(`against ${checks.length} checks`);
  });

  it('publishes an Agent Skill whose digest matches its SKILL.md', async () => {
    const index = JSON.parse(await read('.well-known/agent-skills/index.json'));
    const skill = await read('.well-known/agent-skills/agent-readiness/SKILL.md');
    expect(index.skills[0].url).toBe('/.well-known/agent-skills/agent-readiness/SKILL.md');
    expect(index.skills[0].digest).toBe(`sha256:${createHash('sha256').update(skill).digest('hex')}`);
  });
});

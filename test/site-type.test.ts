import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { compareBaseline } from '../src/baseline';
import { checks, NOT_APPLICABLE } from '../src/registry';
import { formatHuman, formatMarkdown } from '../src/report';
import { scan } from '../src/scanner';
import { client, response, target } from './checks/_helpers';

// robots.txt passes; every other URL is a 404, so the API checks would fail if they ran.
const ROBOTS = 'User-agent: *\nAllow: /\n';
function recordingClient() {
  const urls: string[] = [];
  const http = client((url) => {
    urls.push(url);
    return new URL(url).pathname === '/robots.txt' ? response(200, ROBOTS, 'text/plain') : response(404, 'not found');
  });
  return { http, urls };
}

const selected = checks.filter((c) => ['robots-txt', 'api-catalog', 'mcp-server-card', 'oauth-authorization-server'].includes(c.id));

describe('--site-type', () => {
  it('content: skips API checks without fetching them and leaves them out of the score', async () => {
    const { http, urls } = recordingClient();
    const report = await scan(target, selected, http, { concurrency: 2, siteType: 'content' });

    for (const id of ['api-catalog', 'mcp-server-card', 'oauth-authorization-server']) {
      const result = report.checks.find((c) => c.id === id)!;
      expect(result.status).toBe('skip');
      expect(result.message).toContain('--site-type content');
    }
    expect(urls.some((u) => u.includes('/.well-known/'))).toBe(false);
    expect(report.score).toEqual({ value: 100, grade: 'A+', passed: 1, total: 1 });
    expect(report.siteType).toBe('content');
    expect(report.notApplicable?.sort()).toEqual(['api-catalog', 'mcp-server-card', 'oauth-authorization-server']);
    expect(formatHuman(report)).toContain('site type        content (3 checks not applicable)');
    expect(formatMarkdown(report)).toContain('site type `content` (3 checks not applicable)');
  });

  it('full (default): runs and scores every selected check', async () => {
    const { http, urls } = recordingClient();
    const report = await scan(target, selected, http, { concurrency: 2 });
    expect(report.checks.find((c) => c.id === 'api-catalog')!.status).toBe('fail');
    expect(urls.some((u) => u.includes('/.well-known/api-catalog'))).toBe(true);
    expect(report.score?.total).toBe(4);
    expect(report.siteType).toBeUndefined();
    expect(report.notApplicable).toBeUndefined();
    expect(formatHuman(report)).not.toContain('site type');
  });

  it('switching to content is not a baseline regression', async () => {
    const before = await scan(target, selected, recordingClient().http, { concurrency: 2 });
    const after = await scan(target, selected, recordingClient().http, { concurrency: 2, siteType: 'content' });
    expect(compareBaseline(before, after).regressions).toEqual([]);
  });

  it('only marks registered checks', () => {
    const ids = new Set(checks.map((c) => c.id));
    for (const id of NOT_APPLICABLE.content.ids) expect(ids.has(id)).toBe(true);
  });

  it('rejects an unknown site type with exit 2', async () => {
    const proc = Bun.spawn([process.execPath, join(import.meta.dir, '..', 'src', 'cli.ts'), 'https://example.com', '--site-type', 'blog'], { stderr: 'pipe', stdout: 'pipe' });
    const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    expect(code).toBe(2);
    expect(err).toContain('Unknown --site-type "blog". Use one of: full, content');
  });
});

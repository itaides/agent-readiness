import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as library from '../src/library';
import { startFixtureServer, type Fixture } from '../testdata/fixture-server';

const pkg = JSON.parse(await readFile(join(import.meta.dir, '..', 'package.json'), 'utf8')) as {
  version: string;
  exports: Record<string, { types: string; import: string }>;
};

let fixture: Fixture;
beforeAll(async () => { fixture = await startFixtureServer('all-pass'); });
afterAll(async () => { await fixture?.close(); });

describe('library entry point', () => {
  it('is published as agent-readiness-cli/library with its types', () => {
    expect(pkg.exports['./library']).toEqual({ types: './dist/types/library.d.ts', import: './dist/library.js' });
  });

  it('exports the scan, check list and report API', () => {
    expect(Object.keys(library).sort()).toEqual([
      'NOT_APPLICABLE', 'PRESETS', 'REPORT_CSS', 'REPORT_JS', 'SITE_TYPES', 'VERSION', 'addRemediation', 'checks',
      'createHttpClient', 'createTarget', 'formatHtml', 'formatJson', 'formatMarkdown', 'resolveScore', 'scan',
    ]);
    expect(library.VERSION).toBe(pkg.version);
  });

  it('scans a target and renders the report', async () => {
    const target = library.createTarget({ url: fixture.url });
    const http = library.createHttpClient({ timeoutMs: 5000, userAgent: 'library-test', defaultHeaders: {}, insecure: false });
    const checks = library.checks.filter((c) => c.id === 'robots-txt' || c.id === 'sitemap');
    const report = await library.scan(target, checks, http, { concurrency: 2 });
    expect(report.checks.map((r) => r.status)).toEqual(['pass', 'pass']);
    expect(library.resolveScore(report)?.value).toBe(100);
    expect(library.formatHtml(report)).toContain(library.REPORT_CSS);
    expect(JSON.parse(library.formatJson(report)).target).toBeDefined();
  });
});

import { describe, it, expect } from 'bun:test';

import { startFixtureServer } from '../testdata/fixture-server';
import { createHttpClient } from '../src/http';
import { createTarget } from '../src/target';
import { scan } from '../src/scanner';
import { checks } from '../src/registry';

const http = createHttpClient({
  timeoutMs: 5000,
  userAgent: 'agent-readiness-test/0.0.1',
  defaultHeaders: {},
  insecure: false,
});

describe('e2e against fixture server', () => {
  it('all 13 checks pass against the all-pass fixture (with --include-llms-txt)', async () => {
    const fixture = await startFixtureServer('all-pass');
    try {
      const target = createTarget({ url: fixture.url });
      const report = await scan(target, checks, http, { concurrency: 4 });

      const failures = report.checks.filter((c) => c.status !== 'pass');
      if (failures.length) {
        for (const f of failures) {
          console.error(`FAIL ${f.id}: ${f.message}`);
        }
      }
      expect(failures).toEqual([]);
      expect(report.checks.length).toBe(14);

      expect(report.summary.discoverability.pass).toBe(3);
      expect(report.summary.content.pass).toBe(2);
      expect(report.summary['bot-access'].pass).toBe(3);
      expect(report.summary.capabilities.pass).toBe(6);
    } finally {
      await fixture.close();
    }
  });

  it('default-enabled checks (no llms-txt) all fail against an SPA-fallthrough server (shape validation)', async () => {
    const fixture = await startFixtureServer('all-fail-spa');
    try {
      const target = createTarget({ url: fixture.url });
      const defaultChecks = checks.filter((c) => c.defaultEnabled);
      const report = await scan(target, defaultChecks, http, { concurrency: 4 });

      const passes = report.checks.filter((c) => c.status === 'pass');
      if (passes.length) {
        for (const p of passes) {
          console.error(`UNEXPECTED PASS ${p.id}: ${p.message}`);
        }
      }
      expect(passes).toEqual([]);
      expect(report.checks.length).toBe(13);
    } finally {
      await fixture.close();
    }
  });
});

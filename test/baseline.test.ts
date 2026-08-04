import { describe, expect, it } from 'bun:test';
import { compareBaseline } from '../src/baseline';
import type { CheckResult, Report, Status } from '../src/types';

function report(target: string, statuses: Record<string, Status>): Report {
  const checks: CheckResult[] = Object.entries(statuses).map(([id, status]) => ({
    id,
    status,
    category: 'capabilities',
    title: id,
    message: status,
    spec: { url: 'https://example.com/spec', asOf: '2026-08-04' },
    evidence: {},
  }));
  return {
    version: 1,
    target,
    scannedAt: '2026-08-04T00:00:00.000Z',
    tool: { name: 'agent-readiness', version: '0.0.1' },
    summary: {
      discoverability: { pass: 0, fail: 0, total: 0 },
      content: { pass: 0, fail: 0, total: 0 },
      'bot-access': { pass: 0, fail: 0, total: 0 },
      capabilities: { pass: 0, fail: 0, total: 0 },
      commerce: { pass: 0, fail: 0, total: 0 },
    },
    checks,
  };
}

describe('baseline comparison', () => {
  it('finds regressions, improvements, new checks, and removed checks', () => {
    const baseline = report('https://example.com/', { regressed: 'pass', improved: 'fail', removed: 'pass', unchanged: 'warn' });
    const current = report('https://example.com/', { regressed: 'fail', improved: 'pass', newFail: 'fail', newPass: 'pass', unchanged: 'warn' });
    expect(compareBaseline(baseline, current)).toEqual({
      regressions: ['regressed', 'newFail'],
      improvements: ['improved', 'newPass'],
      removed: ['removed'],
    });
  });

  it('rejects a target mismatch', () => {
    expect(() => compareBaseline(report('https://one.example/', {}), report('https://two.example/', {}))).toThrow('Baseline target mismatch');
  });
});

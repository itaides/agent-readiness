import { describe, expect, it } from 'bun:test';

import { addRemediation } from '../src/remediation';
import { formatHtml, formatHuman, formatJson, formatMarkdown } from '../src/report';
import type { CheckResult, Report } from '../src/types';

const target = 'https://example.com/';

function result(status: CheckResult['status']): CheckResult {
  return {
    id: 'markdown-negotiation',
    category: 'content',
    title: 'Markdown content negotiation',
    status,
    message: 'content-type "text/html" is not text/markdown',
    spec: { url: 'https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/', asOf: '2026-08-04' },
    evidence: {},
  };
}

function report(check: CheckResult): Report {
  return {
    version: 1,
    target,
    scannedAt: '2026-08-04T00:00:00.000Z',
    tool: { name: 'agent-readiness', version: '0.0.1' },
    summary: {
      discoverability: { pass: 0, fail: 0, total: 0 },
      content: { pass: 0, fail: 1, total: 1 },
      'bot-access': { pass: 0, fail: 0, total: 0 },
      capabilities: { pass: 0, fail: 0, total: 0 },
      commerce: { pass: 0, fail: 0, total: 0 },
    },
    checks: [check],
  };
}

describe('actionable remediation', () => {
  it('adds structured guidance and a target-specific verification command to findings', () => {
    const finding = addRemediation(result('fail'), target);

    expect(finding.remediation?.suggestion).toContain('Cloudflare');
    expect(finding.remediation?.promptPath).toBe('prompts/markdown-negotiation.md');
    expect(finding.remediation?.verifyCommand).toBe(
      'agent-readiness https://example.com/ --only markdown-negotiation',
    );
  });

  it('does not add remediation to passing checks', () => {
    expect(addRemediation(result('pass'), target).remediation).toBeUndefined();
  });

  it('renders remediation in every report format', () => {
    const scanReport = report(addRemediation(result('fail'), target));

    expect(formatHuman(scanReport)).toContain('FIX     Return Markdown');
    expect(formatHuman(scanReport)).toContain('VERIFY  agent-readiness https://example.com/ --only markdown-negotiation');
    expect(formatMarkdown(scanReport)).toContain('**How to fix:** Return Markdown');
    expect(formatHtml(scanReport)).toContain('<strong>How to fix</strong>Return Markdown');
    expect(JSON.parse(formatJson(scanReport)).checks[0].remediation.verifyCommand).toContain('--only markdown-negotiation');
  });
});

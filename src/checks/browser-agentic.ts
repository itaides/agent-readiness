import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const META = {
  id: 'browser-agentic',
  category: 'capabilities' as const,
  title: 'Lighthouse Agentic Browsing',
  spec: { url: 'https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring', asOf: '2026-08-04' },
};

interface LighthouseInvocation {
  command: string;
  prefix: string[];
}

function lighthouseInvocation(): LighthouseInvocation {
  if (process.env.AGENT_READINESS_LIGHTHOUSE) return { command: process.env.AGENT_READINESS_LIGHTHOUSE, prefix: [] };
  try {
    return { command: 'node', prefix: [join(dirname(require.resolve('lighthouse/package.json')), 'cli', 'index.js')] };
  } catch {
    return { command: 'lighthouse', prefix: [] };
  }
}

interface LighthouseReport {
  categories?: Record<string, { auditRefs?: Array<{ id: string }> }>;
  audits?: Record<string, { score?: number | null; scoreDisplayMode?: string; title?: string; errorMessage?: string }>;
  environment?: { hostUserAgent?: string; benchmarkIndex?: number };
}

const browserAgentic: Check = {
  ...META,
  defaultEnabled: false,
  scored: false,

  async run(target): Promise<CheckResult> {
    const invocation = lighthouseInvocation();
    const url = target.contentUrl.toString();
    const evidence: Evidence = { request: { method: 'BROWSER', url } };
    try {
      const { stdout, stderr } = await execFileAsync(invocation.command, [
        ...invocation.prefix,
        url,
        '--only-categories=agentic-browsing',
        '--output=json',
        '--output-path=stdout',
        '--chrome-flags=--headless=new',
        '--quiet',
      ], { maxBuffer: 25 * 1024 * 1024, timeout: 120_000 });
      const report = JSON.parse(stdout) as LighthouseReport;
      const category = report.categories?.['agentic-browsing'];
      if (!category?.auditRefs || !report.audits) return makeResult(META, 'warn', 'Lighthouse report does not include the agentic-browsing category (requires Lighthouse 13.3+)', evidence);
      const rows = category.auditRefs.map(({ id }) => ({ id, audit: report.audits?.[id] })).filter((row) => row.audit);
      const measured = rows.filter((row) => row.audit?.score === 0 || row.audit?.score === 1);
      const failed = measured.filter((row) => row.audit?.score === 0);
      const passed = measured.length - failed.length;
      evidence.note = [
        `Lighthouse ${passed}/${measured.length} measured audits passing`,
        failed.length ? `failed: ${failed.map((row) => row.id).join(', ')}` : 'failed: none',
        report.environment?.hostUserAgent ? `browser: ${report.environment.hostUserAgent}` : '',
        stderr.trim() ? `stderr: ${stderr.trim().slice(0, 300)}` : '',
      ].filter(Boolean).join('; ');
      if (measured.length === 0) return makeResult(META, 'warn', 'Agentic Browsing produced no measured audits', evidence);
      if (failed.length) return makeResult(META, 'warn', `${passed}/${measured.length} Lighthouse agentic audits passed`, evidence);
      return makeResult(META, 'pass', `${passed}/${measured.length} Lighthouse agentic audits passed`, evidence);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === 'ENOENT') return makeResult(META, 'skip', 'Lighthouse is not installed; install lighthouse@13.3+ or set AGENT_READINESS_LIGHTHOUSE', evidence);
      return makeResult(META, 'warn', `Lighthouse could not run: ${error instanceof Error ? error.message : String(error)}`, evidence);
    }
  },
};

export default browserAgentic;

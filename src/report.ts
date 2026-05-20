import type { Report, Status } from './types';

const ICON: Record<Status, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  warn: 'WARN',
  skip: 'SKIP',
};

export function formatHuman(report: Report): string {
  const lines: string[] = [];
  lines.push(`agent-readiness  ${report.target}`);
  lines.push(`scanned          ${report.scannedAt}`);
  lines.push('');

  const cats = Object.keys(report.summary) as Array<keyof typeof report.summary>;
  for (const cat of cats) {
    const s = report.summary[cat];
    lines.push(`[${cat}] ${s.pass}/${s.total} passing`);
    const checks = report.checks.filter((c) => c.category === cat);
    for (const c of checks) {
      lines.push(`  ${ICON[c.status]}  ${c.title} — ${c.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

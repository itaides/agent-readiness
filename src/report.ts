import { renderHtml } from './report-html';
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

  const cats = (Object.keys(report.summary) as Array<keyof typeof report.summary>)
    .filter((cat) => report.checks.some((check) => check.category === cat));
  for (const cat of cats) {
    const s = report.summary[cat];
    const score = s.total > 0 ? `${s.pass}/${s.total} passing` : 'informational';
    lines.push(`[${cat}] ${score}`);
    const checks = report.checks.filter((c) => c.category === cat);
    for (const c of checks) {
      lines.push(`  ${ICON[c.status]}  ${c.title} — ${c.message}`);
      if (c.remediation) {
        lines.push(`        FIX     ${c.remediation.suggestion}`);
        lines.push(`        VERIFY  ${c.remediation.verifyCommand}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function formatHtml(report: Report): string {
  return renderHtml(report, formatMarkdown(report));
}

export function formatMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# agent-readiness — ${report.target}`);
  lines.push('');
  lines.push(`Scanned ${report.scannedAt} · ${report.tool.name} ${report.tool.version}`);
  lines.push('');

  lines.push('| Category | Passing |');
  lines.push('|---|---|');
  const cats = (Object.keys(report.summary) as Array<keyof typeof report.summary>)
    .filter((cat) => report.checks.some((check) => check.category === cat));
  for (const cat of cats) {
    const s = report.summary[cat];
    lines.push(`| ${cat} | ${s.total > 0 ? `${s.pass}/${s.total}` : 'informational'} |`);
  }
  lines.push('');

  for (const cat of cats) {
    const checks = report.checks.filter((c) => c.category === cat);
    if (checks.length === 0) continue;
    lines.push(`## ${cat}`);
    lines.push('');
    for (const c of checks) {
      lines.push(`- **${c.status.toUpperCase()}** · ${c.title} — ${c.message}`);
      if (c.remediation) {
        lines.push(`  - **How to fix:** ${c.remediation.suggestion}`);
        lines.push(`  - **Verify:** \`${c.remediation.verifyCommand}\``);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

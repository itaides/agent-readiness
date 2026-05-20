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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HTML_CSS = `:root{--pass:#16a34a;--fail:#dc2626;--warn:#ca8a04;--skip:#6b7280;--fg:#111827;--muted:#6b7280;--bg:#fff;--card:#f9fafb;--border:#e5e7eb;--accent:#2563eb}@media (prefers-color-scheme:dark){:root{--fg:#e5e7eb;--muted:#9ca3af;--bg:#0a0a0a;--card:#171717;--border:#262626;--accent:#60a5fa}}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:2rem 1rem;line-height:1.5}.wrap{max-width:64rem;margin:0 auto}.header{margin-bottom:1.5rem}h1{font-size:1.5rem;margin:0 0 .25rem;font-weight:600;letter-spacing:-.01em}.target{color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;font-size:.9rem}.meta{color:var(--muted);font-size:.8rem;margin-top:.5rem}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin:1.5rem 0 2rem}.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem}.card h3{margin:0 0 .25rem;font-size:.7rem;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.card .score{font-size:1.5rem;font-weight:600;font-family:ui-monospace,monospace;letter-spacing:-.02em}.card .score .total{color:var(--muted);font-weight:400}h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:1.5rem 0 .5rem;font-weight:600}.check{display:flex;align-items:flex-start;gap:.75rem;padding:.875rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--card);margin-bottom:.5rem}.badge{display:inline-block;font-size:.7rem;font-weight:600;padding:.125rem .5rem;border-radius:999px;color:#fff;flex-shrink:0;min-width:3.25rem;text-align:center;letter-spacing:.02em}.badge.pass{background:var(--pass)}.badge.fail{background:var(--fail)}.badge.warn{background:var(--warn)}.badge.skip{background:var(--skip)}.body{flex:1;min-width:0}.title{font-weight:600;margin:0 0 .125rem;font-size:.95rem}.message{color:var(--muted);font-size:.875rem;word-wrap:break-word}details{margin-top:.5rem;font-size:.8rem}details summary{cursor:pointer;color:var(--muted);user-select:none}details summary:hover{color:var(--fg)}details pre{background:var(--bg);border:1px solid var(--border);padding:.75rem;margin:.5rem 0 0;border-radius:6px;overflow-x:auto;font-size:.7rem;line-height:1.4}footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:.75rem}footer a{color:var(--accent);text-decoration:none}footer a:hover{text-decoration:underline}`;

export function formatHtml(report: Report): string {
  const target = escapeHtml(report.target);
  const scannedAt = escapeHtml(report.scannedAt);
  const toolLabel = `${escapeHtml(report.tool.name)} ${escapeHtml(report.tool.version)}`;

  const cats = Object.keys(report.summary) as Array<keyof typeof report.summary>;

  const summaryCards = cats
    .map((cat) => {
      const s = report.summary[cat];
      return `<div class="card"><h3>${escapeHtml(cat)}</h3><div class="score">${s.pass}<span class="total">/${s.total}</span></div></div>`;
    })
    .join('');

  const groups = cats
    .map((cat) => {
      const checks = report.checks.filter((c) => c.category === cat);
      if (checks.length === 0) return '';
      const rows = checks
        .map((c) => {
          const evidence = escapeHtml(JSON.stringify(c.evidence, null, 2));
          return `<div class="check"><span class="badge ${c.status}">${c.status.toUpperCase()}</span><div class="body"><div class="title">${escapeHtml(c.title)}</div><div class="message">${escapeHtml(c.message)}</div><details><summary>Evidence</summary><pre>${evidence}</pre></details></div></div>`;
        })
        .join('');
      return `<h2>${escapeHtml(cat)}</h2>${rows}`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>agent-readiness — ${target}</title>
<style>${HTML_CSS}</style>
</head>
<body>
<div class="wrap">
<div class="header">
<h1>agent-readiness</h1>
<div class="target">${target}</div>
<div class="meta">Scanned ${scannedAt} · ${toolLabel}</div>
</div>
<div class="summary">${summaryCards}</div>
${groups}
<footer>Generated by <a href="https://github.com/itaides/agent-readiness">agent-readiness</a>.</footer>
</div>
</body>
</html>`;
}

export function formatMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# agent-readiness — ${report.target}`);
  lines.push('');
  lines.push(`Scanned ${report.scannedAt} · ${report.tool.name} ${report.tool.version}`);
  lines.push('');

  lines.push('| Category | Passing |');
  lines.push('|---|---|');
  const cats = Object.keys(report.summary) as Array<keyof typeof report.summary>;
  for (const cat of cats) {
    const s = report.summary[cat];
    lines.push(`| ${cat} | ${s.pass}/${s.total} |`);
  }
  lines.push('');

  for (const cat of cats) {
    const checks = report.checks.filter((c) => c.category === cat);
    if (checks.length === 0) continue;
    lines.push(`## ${cat}`);
    lines.push('');
    for (const c of checks) {
      lines.push(`- **${c.status.toUpperCase()}** · ${c.title} — ${c.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

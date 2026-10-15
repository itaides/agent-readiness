import { formatMarkdown } from '../report';
import type { Category, CheckResult, Evidence, Report, Status } from '../types';
import { reportCss, reportJs } from './minify' with { type: 'macro' };

// Minified at build time and exported so pages that embed reports can reuse them. Kept behind one
// object so the minifier doesn't inline the strings where they're used and keep a second copy.
const ASSETS = { css: reportCss(), js: reportJs() };
export const REPORT_CSS: string = ASSETS.css;
export const REPORT_JS: string = ASSETS.js;

const REPO_URL = 'https://github.com/itaides/agent-readiness';
const CHECKS_DOC_URL = `${REPO_URL}/blob/main/docs/checks.md`;

const CATEGORY_ORDER: Category[] = ['discoverability', 'content', 'bot-access', 'capabilities', 'commerce'];

const CATEGORY_META: Record<Category, { label: string; question: string }> = {
  discoverability: { label: 'Discoverability', question: 'Can an agent find you?' },
  content: { label: 'Content', question: 'Can an agent read you?' },
  'bot-access': { label: 'Bot access', question: 'Are agents welcome, and can they prove who they are?' },
  capabilities: { label: 'Capabilities', question: 'Can an agent use you, not just read you?' },
  commerce: { label: 'Commerce', question: 'Can an agent buy from you?' },
};

const STATUS_ORDER: Record<Status, number> = { fail: 0, warn: 1, skip: 2, pass: 3 };

const GLYPH: Record<Status, string> = {
  pass: '<path d="M3 8.5l3.2 3.2L13 5"></path>',
  fail: '<path d="M4 4l8 8M12 4l-8 8"></path>',
  warn: '<path d="M8 3v6.5M8 12.6v.4"></path>',
  skip: '<path d="M4 8h8"></path>',
};

type Score = NonNullable<Report['score']>;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

export function gradeFor(value: number): string {
  return value >= 97 ? 'A+' : value >= 90 ? 'A' : value >= 80 ? 'B' : value >= 70 ? 'C' : value >= 50 ? 'D' : 'F';
}

/** Report.score when the scanner provided it, otherwise derived from the scored category summary. */
export function resolveScore(report: Report): Score | undefined {
  if (report.score) return report.score;
  let passed = 0;
  let total = 0;
  for (const cat of CATEGORY_ORDER) {
    passed += report.summary[cat]?.pass ?? 0;
    total += report.summary[cat]?.total ?? 0;
  }
  if (total === 0) return undefined;
  const value = Math.round((passed / total) * 100);
  return { value, grade: gradeFor(value), passed, total };
}

function band(grade: string): Status {
  if (grade.startsWith('A') || grade === 'B') return 'pass';
  if (grade === 'C' || grade === 'D') return 'warn';
  return 'fail';
}

function verdictLabel(grade: string): string {
  if (grade.startsWith('A')) return 'Agent-ready';
  if (grade === 'B') return 'Mostly agent-ready';
  if (grade === 'C' || grade === 'D') return 'Partly agent-ready';
  return 'Not agent-ready';
}

function isScored(c: CheckResult): boolean {
  return c.scored !== false;
}

function isScoredFail(c: CheckResult): boolean {
  return c.status === 'fail' && isScored(c);
}

/**
 * Points gained by fixing each scored failure. Every scored check is worth 100 / total;
 * remainders go to the first failures so the gains add up to exactly 100 − score.
 */
export function pointGains(fails: CheckResult[], score: Score | undefined): Map<string, number> {
  const gains = new Map<string, number>();
  if (!score || fails.length === 0) return gains;
  const remaining = Math.max(0, 100 - score.value);
  const base = Math.floor(remaining / fails.length);
  let extra = remaining - base * fails.length;
  for (const f of fails) {
    gains.set(f.id, base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  return gains;
}

function icon(status: Status, size = 10): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[status]}</svg>`;
}

function badge(status: Status): string {
  return `<span class="badge">${icon(status)}${status.toUpperCase()}</span>`;
}

const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2"></rect><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"></path></svg>';
const CHEVRON = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 4l4 4-4 4"></path></svg>';
const WRENCH = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5a3 3 0 0 0-3.9 3.9L2.5 10.5a1.4 1.4 0 0 0 2 2l4.1-4.1a3 3 0 0 0 3.9-3.9l-1.8 1.8-1.7-.3-.3-1.7z"></path></svg>';

function copyButton(text: string, label = 'Copy', aria?: string): string {
  const ariaAttr = aria ? ` aria-label="${esc(aria)}"` : '';
  return `<button class="btn" type="button" data-copy="${esc(text)}"${ariaAttr}>${COPY_ICON}<span data-label>${esc(label)}</span></button>`;
}

function cmd(text: string, aria?: string): string {
  return `<div class="cmd"><span class="pr">$</span><code>${esc(text)}</code>${copyButton(text, 'Copy', aria)}</div>`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time} UTC`;
}

function targetHeading(target: string): string {
  const m = /^(https?:\/\/)(.*)$/.exec(target);
  const rest = m ? m[2].replace(/\/$/, '') : target;
  return m ? `<span>${esc(m[1])}</span>${esc(rest)}` : esc(rest);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function shortUrl(url: string, origin: string): string {
  try {
    const u = new URL(url);
    return u.origin === origin ? `${u.pathname}${u.search}` : url;
  } catch {
    return url;
  }
}

function httpStatus(code: number): Status {
  if (code >= 400) return 'fail';
  if (code >= 300) return 'warn';
  return 'pass';
}

function hasEvidence(e: Evidence): boolean {
  return Object.keys(e).length > 0;
}

function evidenceSummary(e: Evidence): string {
  if (e.request && e.response) {
    const parts = [`${e.request.method} → ${e.response.status}`];
    if (e.response.contentType) parts.push(e.response.contentType.split(';')[0]);
    if (typeof e.response.bytes === 'number') parts.push(formatBytes(e.response.bytes));
    return parts.join(' · ');
  }
  if (e.request) return `${e.request.method} → no response`;
  if (e.note && Object.keys(e).length === 1) return 'note only';
  return 'details';
}

function probeLog(e: Evidence, origin: string): string {
  if (!e.request) return '';
  const lines: string[] = [];
  const chain = e.response?.redirectChain ?? [];
  if (chain.length > 1) {
    chain.slice(0, -1).forEach((url) => {
      lines.push(`<li data-status="warn"><span class="m">${esc(e.request!.method)}</span><span class="u">${esc(shortUrl(url, origin))}</span><span class="r">redirect</span></li>`);
    });
  }
  const finalUrl = e.response?.finalUrl ?? e.request.url;
  const result = e.response ? String(e.response.status) : 'no response';
  const status: Status = e.response ? httpStatus(e.response.status) : 'fail';
  lines.push(`<li data-status="${status}"><span class="m">${esc(e.request.method)}</span><span class="u">${esc(shortUrl(finalUrl, origin))}</span><span class="r">${esc(result)}</span></li>`);
  return `<ol class="probe-l" aria-label="Requests the scanner made">${lines.join('')}</ol>`;
}

/** Escapes JSON and wraps keys, strings and numbers for light syntax tinting. */
export function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2) ?? '';
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  let out = '';
  let last = 0;
  for (const m of json.matchAll(token)) {
    out += esc(json.slice(last, m.index));
    const [whole, str, colon, num, lit] = m;
    if (str !== undefined) out += colon ? `<span class="j-k">${esc(str)}</span>${colon}` : `<span class="j-s">${esc(str)}</span>`;
    else out += `<span class="j-n">${esc(num ?? lit ?? whole)}</span>`;
    last = m.index + whole.length;
  }
  return out + esc(json.slice(last));
}

function fixBlock(c: CheckResult, gain: number | undefined, compactHeading = false): string {
  const links: string[] = [];
  if (gain !== undefined) links.push(`<a href="#fix" data-open-fix="${esc(c.id)}">Fix with AI →</a>`);
  if (c.remediation?.promptPath) links.push(`<span class="mono">${esc(c.remediation.promptPath)}</span>`);
  if (c.spec?.url) links.push(`<a href="${esc(c.spec.url)}" rel="noopener">Spec ↗</a>`);
  const linkRow = links.length ? `<div class="fix-links">${links.join('')}</div>` : '';

  if (!c.remediation) {
    if (c.status !== 'fail') return '';
    return `<div class="fix none"><div class="fix-h">No automated fix</div><p>This check has no suggestion yet. The spec explains what passing looks like.</p>${linkRow}</div>`;
  }
  const heading = compactHeading ? '<div class="fix-h">How to fix</div>' : `<div class="fix-h">${WRENCH}How to fix</div>`;
  return `<div class="fix">${heading}<p>${esc(c.remediation.suggestion)}</p><div class="verify"><span class="verify-l">Verify</span>${cmd(c.remediation.verifyCommand, 'Copy verify command')}</div>${linkRow}</div>`;
}

function evidenceBody(c: CheckResult, origin: string): string {
  if (!hasEvidence(c.evidence)) return '';
  const note = c.evidence.note ? `<p class="ev-note">${esc(c.evidence.note)}</p>` : '';
  return `${probeLog(c.evidence, origin)}${note}<pre>${highlightJson(c.evidence)}</pre>`;
}

function checkRow(c: CheckResult, opts: { origin: string; gain?: number; expanded: boolean }): string {
  const compact = c.status === 'pass' || c.status === 'skip';
  const tags: string[] = [];
  if (opts.gain !== undefined) tags.push(`<span class="gain">+${opts.gain} pts</span>`);
  if (c.status === 'warn' || (c.status === 'fail' && !isScored(c))) tags.push('<span class="tag">Bonus · not scored</span>');
  const msg = c.status === 'pass' ? '' : `<p class="msg">${esc(c.message)}</p>`;

  let detail = '';
  if (!compact) {
    const fix = fixBlock(c, opts.gain, !opts.expanded);
    const ev = evidenceBody(c, opts.origin);
    if (opts.expanded) {
      const evidence = ev
        ? `<details class="ev" open><summary>${CHEVRON}<span class="sum-k">Evidence</span><span class="mono">${esc(evidenceSummary(c.evidence))}</span></summary>${ev}</details>`
        : '';
      detail = fix || evidence ? `<div class="detail">${fix}${evidence}</div>` : '';
    } else if (fix || ev) {
      const label = fix && ev ? 'How to fix &amp; evidence' : fix ? 'How to fix' : 'Evidence';
      const summary = ev ? `<span class="mono">${esc(evidenceSummary(c.evidence))}</span>` : '';
      const body = `${fix ? `<div class="ev-body">${fix}</div>` : ''}${ev}`;
      detail = `<div class="detail"><details class="ev"><summary>${CHEVRON}<span class="sum-k">${label}</span>${summary}</summary>${body}</details></div>`;
    }
  }

  return `<div class="row${compact ? ' compact' : ''}" data-status="${c.status}">${badge(c.status)}<div class="body"><p class="title">${esc(c.title)}${tags.join('')}</p>${msg}</div><span class="cid">${esc(c.id)}</span>${detail}</div>`;
}

function segments(pass: number, fail: number, cls = 'seg'): string {
  if (pass + fail === 0) return '';
  const parts =
    pass + fail > 12
      ? `<i data-status="pass" style="flex: ${pass}"></i><i data-status="fail" style="flex: ${fail}"></i>`
      : `${'<i data-status="pass"></i>'.repeat(pass)}${'<i data-status="fail"></i>'.repeat(fail)}`;
  return `<span class="${cls}" aria-hidden="true">${parts}</span>`;
}

interface CategoryView {
  cat: Category;
  num: string;
  checks: CheckResult[];
  pass: number;
  fail: number;
  total: number;
  warns: number;
  skips: number;
}

function categoryFoot(v: CategoryView): string {
  const bits: string[] = [];
  if (v.warns) bits.push(plural(v.warns, 'warning'));
  if (v.skips) bits.push(`${v.skips} skipped`);
  if (bits.length) return bits.join(' · ');
  if (v.total === 0) return 'Informational';
  return v.fail === 0 ? 'All passing' : '';
}

function tally(v: CategoryView): string {
  const bits = [v.total > 0 ? `${v.pass}/${v.total} passing` : 'informational'];
  if (v.warns) bits.push(plural(v.warns, 'warning'));
  if (v.skips) bits.push(`${v.skips} skipped`);
  return bits.join(' · ');
}

function crawlSection(report: Report): string {
  const crawl = report.crawl;
  if (!crawl) return '';
  const titles = new Map(report.checks.map((c) => [c.id, c.title]));
  const rows = Object.entries(crawl.perCheck)
    .sort(([, a], [, b]) => b.fail - a.fail || b.warn - a.warn)
    .map(([id, s]) => {
      const pages = s.pass + s.warn + s.fail;
      const pct = (n: number) => (pages ? (n / pages) * 100 : 0).toFixed(1);
      const rate = s.pass + s.fail > 0 ? `${Math.round((s.pass / (s.pass + s.fail)) * 100)}%` : '—';
      const bar = [
        s.pass ? `<i data-status="pass" style="inline-size: ${pct(s.pass)}%"></i>` : '',
        s.warn ? `<i data-status="warn" style="inline-size: ${pct(s.warn)}%"></i>` : '',
        s.fail ? `<i data-status="fail" style="inline-size: ${pct(s.fail)}%"></i>` : '',
      ].join('');
      return `<tr><td>${esc(titles.get(id) ?? id)}</td><td><div class="rate"><div class="bar">${bar}</div><span class="rate-v">${rate}</span></div></td><td class="num">${s.pass}</td><td class="num">${s.warn}</td><td class="num">${s.fail}</td></tr>`;
    })
    .join('');
  const n = crawl.pages.length;
  return `<section class="crawl" id="crawl">
<div class="group-h"><h2>Across ${plural(n, 'sampled page')}</h2><span class="tally">from the sitemap</span></div>
<p class="crawl-sub">Page-level checks, aggregated. Pass rate = pass ÷ (pass + fail); warnings shown but not counted.</p>
<div class="tbl-box"><table class="tbl">
<thead><tr><th>Check</th><th>Pass rate</th><th class="num">Pass</th><th class="num">Warn</th><th class="num">Fail</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
</section>`;
}

function fixDialog(report: Report, views: CategoryView[], gains: Map<string, number>, score: Score | undefined): string {
  const scoredFails = views.flatMap((v) => v.checks.filter(isScoredFail));
  if (scoredFails.length === 0) return '';
  const bonus = report.checks.filter((c) => c.status === 'warn' || (c.status === 'fail' && !isScored(c)));

  const data: Record<string, { title: string; finding: string; fix?: string; verify?: string; prompt?: string; spec?: string }> = {};
  for (const c of [...scoredFails, ...bonus]) {
    data[c.id] = {
      title: c.title,
      finding: c.message,
      fix: c.remediation?.suggestion,
      verify: c.remediation?.verifyCommand,
      prompt: c.remediation?.promptPath,
      spec: c.spec?.url,
    };
  }

  const item = (c: CheckResult, pts: number, isBonus: boolean): string => {
    const status = isBonus ? 'warn' : 'pass';
    const gainText = isBonus ? '+0' : `+${pts} pts`;
    const details = [
      `<p><b>Finding</b>${esc(c.message)}</p>`,
      c.remediation ? `<p><b>Fix</b>${esc(c.remediation.suggestion)}</p>` : '',
      c.remediation ? `<p><b>Verify</b>${esc(c.remediation.verifyCommand)}</p>` : '',
    ].join('');
    return `<label class="pick"><input type="checkbox" name="fix" value="${esc(c.id)}" style="--pts: ${pts}"${isBonus ? ' data-bonus' : ''}><span class="t">${esc(c.title)}</span><span class="id">${esc(c.id)}</span><span class="gain" data-status="${status}">${gainText}</span></label>
<details class="more"><summary>Finding, fix, verify</summary><div class="ffw">${details}</div></details>`;
  };

  const groups = views
    .map((v) => {
      const fails = v.checks.filter(isScoredFail);
      if (!fails.length) return '';
      return `<section class="fcat"><h3>[${v.num}] ${esc(CATEGORY_META[v.cat].label)}<span>${fails.length} failing</span></h3>${fails.map((c) => item(c, gains.get(c.id) ?? 0, false)).join('')}</section>`;
    })
    .join('');
  const bonusGroup = bonus.length
    ? `<section class="fcat bonus"><h3>Bonus · not scored<span>${plural(bonus.length, 'finding')}</span></h3>${bonus.map((c) => item(c, 0, true)).join('')}</section>`
    : '';
  const total = scoredFails.length + bonus.length;
  const json = JSON.stringify({ target: report.target, checks: data }).replace(/</g, '\\u003c');

  return `<dialog id="fix" class="fixdlg" aria-labelledby="fix-title" style="--score: ${score?.value ?? 0}">
<header class="dlg-h"><h2 id="fix-title">Fix with AI</h2><p>Pick the findings to fix. You get one prompt for your coding agent, with the finding, the fix and a verify command for each.</p><a class="x" href="#" aria-label="Close"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"></path></svg></a></header>
<div class="dlg-b">${groups}${bonusGroup}</div>
<footer class="dlg-f"><p class="sum" aria-live="polite" data-total="${total}"><b data-score="${score?.value ?? 0}"></b><span class="tokens"></span></p><details class="preview"><summary>Preview prompt</summary><pre></pre></details><button class="btn primary copy" type="button">${COPY_ICON}<span data-label>Copy prompt</span></button></footer>
</dialog>
<script type="application/json" id="fix-data">${json}</script>`;
}

function shareSection(score: Score | undefined): string {
  if (!score) return '';
  const status = band(score.grade);
  const color = status === 'pass' ? 'brightgreen' : status === 'warn' ? 'yellow' : 'red';
  const label = `${score.value} · ${score.grade}`;
  const img = `https://img.shields.io/badge/agent--ready-${encodeURIComponent(label)}-${color}`;
  const md = `[![agent-ready: ${label}](${img})](${REPO_URL})`;
  const html = `<a href="${REPO_URL}"><img alt="agent-ready: ${label}" src="${img}"></a>`;
  return `<section class="share" id="share">
<div><h2>Show your score</h2><p>A badge for your README or docs. The badge image is served by shields.io when someone views your README; this report itself makes no requests.</p></div>
<div class="share-row"><span class="score-badge" data-status="${status}"><span>agent-ready</span><b>${esc(label)}</b></span>${copyButton(md, 'Copy Markdown')}${copyButton(html, 'Copy HTML')}</div>
</section>`;
}

/** Self-contained HTML report: inline CSS and JS, no external requests. */
export interface HtmlOptions {
  /** Where the report will be published. Adds a canonical link and og:url; the CLI can't know it. */
  canonicalUrl?: string;
}

/** Head metadata so a published report is itself readable by agents: description, Open Graph, JSON-LD. */
function headMeta(report: Report, score: Score | undefined, title: string, opts: HtmlOptions): string {
  const when = formatDate(report.scannedAt);
  const description = score
    ? `agent-readiness report for ${report.target}: ${score.value}/100 (grade ${score.grade}), ${score.passed} of ${score.total} scored checks passing. Scanned ${when}.`
    : `agent-readiness report for ${report.target}: ${report.checks.length} checks. Scanned ${when}.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: title,
    description,
    datePublished: report.scannedAt,
    ...(opts.canonicalUrl ? { url: opts.canonicalUrl } : {}),
    about: { '@type': 'WebSite', url: report.target },
    creator: { '@type': 'SoftwareApplication', name: report.tool.name, softwareVersion: report.tool.version, url: REPO_URL },
  };
  return [
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    ...(opts.canonicalUrl ? [`<meta property="og:url" content="${esc(opts.canonicalUrl)}">`, `<link rel="canonical" href="${esc(opts.canonicalUrl)}">`] : []),
    // Escape < so report text can't close the script element.
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

export function renderHtml(report: Report, agentView: string, opts: HtmlOptions = {}): string {
  const origin = (() => {
    try {
      return new URL(report.target).origin;
    } catch {
      return '';
    }
  })();
  const score = resolveScore(report);
  const grade = score?.grade ?? '';
  const scoreStatus: Status = score ? band(grade) : 'skip';

  const views: CategoryView[] = CATEGORY_ORDER.filter((cat) => report.checks.some((c) => c.category === cat)).map((cat, i) => {
    const checks = report.checks
      .filter((c) => c.category === cat)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const s = report.summary[cat] ?? { pass: 0, fail: 0, total: 0 };
    return {
      cat,
      num: String(i + 1).padStart(2, '0'),
      checks,
      pass: s.pass,
      fail: s.fail,
      total: s.total,
      warns: checks.filter((c) => c.status === 'warn').length,
      skips: checks.filter((c) => c.status === 'skip').length,
    };
  });

  const ordered = views.flatMap((v) => v.checks);
  const scoredFails = ordered.filter(isScoredFail);
  const gains = pointGains(scoredFails, score);
  const firstFailId = ordered.find((c) => c.status === 'fail')?.id;
  const counts: Record<Status, number> = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const c of report.checks) counts[c.status] += 1;

  const target = esc(report.target);
  const title = `${score ? `${score.value}/100 (${grade}) · ` : ''}${report.target} · agent readiness`;
  const scannedAt = formatDate(report.scannedAt);
  const toolLabel = `${esc(report.tool.name)} ${esc(report.tool.version)}`;
  const rerun = `${report.tool.name} ${report.target} --format html`;

  const failingCats = views.filter((v) => v.checks.some(isScoredFail)).map((v) => CATEGORY_META[v.cat].label.toLowerCase());
  const verdict = score
    ? `<p class="verdict" data-status="${scoreStatus}"><b>${esc(grade)} · ${verdictLabel(grade)}</b><span>${
        scoredFails.length
          ? `${plural(scoredFails.length, 'scored check')} failing in ${esc(failingCats.join(', '))}. Fixing ${scoredFails.length === 1 ? 'it' : 'them'} gets you to 100.`
          : 'Every scored check passes.'
      }</span></p>`
    : '<p class="verdict" data-status="skip"><b>No score</b><span>No scored checks ran, so this report is informational.</span></p>';

  const ring = score
    ? `<div class="ring" data-status="${scoreStatus}"><progress value="${score.value}" max="100" aria-label="Agent readiness score ${score.value} of 100, grade ${esc(grade)}" style="--value: ${score.value}"></progress><div class="ring-c" aria-hidden="true"><div class="ring-num" data-n="${score.value}"><span>${score.value}</span></div><div class="ring-of">/ 100</div><div class="grade">Grade <b>${esc(grade)}</b></div></div></div>`
    : '<div class="ring empty" data-status="skip"><progress max="100" aria-label="No scored checks ran"></progress><div class="ring-c" aria-hidden="true"><div class="ring-num">—</div><div class="ring-of">no score</div><div class="grade">Info only</div></div></div>';

  const stats = [
    score ? `<span class="stat" data-status="pass"><b>${score.passed}/${score.total}</b> scored checks passing</span>` : '',
    counts.warn ? `<span class="stat" data-status="warn"><b>${counts.warn}</b> ${counts.warn === 1 ? 'warning' : 'warnings'}, not scored</span>` : '',
    counts.skip ? `<span class="stat" data-status="skip"><b>${counts.skip}</b> skipped</span>` : '',
    report.crawl ? `<span class="stat" data-status="skip"><b>${report.crawl.pages.length}</b> pages crawled</span>` : '',
  ].join('');

  const fixCta = scoredFails.length
    ? `<a class="btn primary" href="#fix" data-open-fix>Fix with AI · ${plural(scoredFails.length, 'failure')}</a>`
    : '';
  const actions = fixCta || score ? `<div class="actions">${fixCta}${score ? '<a class="btn" href="#share">Share badge</a>' : ''}</div>` : '';

  const cats = views
    .map(
      (v) => `<a class="cat" href="#cat-${v.cat}"><span class="cat-name">${esc(CATEGORY_META[v.cat].label)}</span>${
        v.total > 0 ? `<span class="cat-score">${v.pass}<span>/${v.total}</span></span>` : '<span class="cat-score info">Informational</span>'
      }${segments(v.pass, v.fail)}<span class="cat-foot">${categoryFoot(v)}</span></a>`,
    )
    .join('');

  const chip = (id: string, label: string, n: number) =>
    `<label class="chip"><input type="radio" name="status-filter" id="${id}">${label} <b>${n}</b></label>`;
  const filters = [
    chip('f-all', 'All', report.checks.length),
    counts.fail ? chip('f-fail', 'Failing', counts.fail) : '',
    counts.warn ? chip('f-warn', 'Warnings', counts.warn) : '',
    counts.pass ? chip('f-pass', 'Passing', counts.pass) : '',
    counts.skip ? chip('f-skip', 'Skipped', counts.skip) : '',
  ].join('');

  const groups = views
    .map((v) => {
      const rows = v.checks
        .map((c) => checkRow(c, { origin, gain: gains.get(c.id), expanded: c.id === firstFailId }))
        .join('');
      const meta = CATEGORY_META[v.cat];
      return `<section class="group" id="cat-${v.cat}"><div class="group-h"><h2><span class="gnum">[${v.num}]</span>${esc(meta.label)}</h2><span class="tally">${tally(v)}</span></div><p class="gq">${esc(meta.question)}</p><div class="list">${rows}</div></section>`;
    })
    .join('\n');

  const rail = `<aside class="rail" aria-label="On this report"><div><p class="rail-h">On this report</p><ol>${views
    .map(
      (v) => `<li><a href="#cat-${v.cat}"><span>${esc(CATEGORY_META[v.cat].label)}</span><span class="n">${v.total > 0 ? `${v.pass}/${v.total}` : 'info'}</span>${segments(v.pass, v.fail, 'mini')}</a></li>`,
    )
    .join('')}${report.crawl ? `<li><a href="#crawl"><span>Crawl · ${report.crawl.pages.length} pages</span><span class="n">—</span></a></li>` : ''}</ol></div>${
    score
      ? `<div class="rail-score" data-status="${scoreStatus}"><b>${score.value} <span>· ${esc(grade)}</span></b><p>${
          scoredFails.length ? `${plural(scoredFails.length, 'failure')} to fix.` : 'Every scored check passes.'
        }</p>${scoredFails.length ? '<a class="btn primary" href="#fix" data-open-fix>Fix with AI</a>' : ''}</div>`
      : ''
  }</aside>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
${headMeta(report, score, title, opts)}
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="ar">
<header class="topbar"><div class="wrap">
<div class="brand"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="6" stroke="currentColor" stroke-width="1.6"></rect><path class="tick" d="M7 11.5l2.6 2.6L15 8.6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>agent-readiness</div>
<nav class="toplinks" aria-label="Report links"><a href="#checks">Checks</a>${report.crawl ? '<a href="#crawl">Crawl</a>' : ''}<a href="${CHECKS_DOC_URL}" rel="noopener">Docs</a></nav>
</div></header>

<main class="wrap">
<section class="hero" aria-label="Score">
${ring}
<div class="meta">
<p class="eyebrow">Agent readiness report</p>
<h1 class="target">${targetHeading(report.target)}</h1>
${verdict}
<div class="scanned"><span>Scanned ${esc(scannedAt)}</span><span class="mono">${toolLabel}</span></div>
<div class="stats">${stats}</div>
${actions}
${cmd(rerun, 'Copy scan command')}
</div>
</section>

<nav class="cats" aria-label="Categories">${cats}</nav>

<div class="report-body">
<div class="checks">
<fieldset class="filters" id="checks"><legend class="vh">Filter checks by status</legend>${filters}</fieldset>
${groups}
${crawlSection(report)}
<pre class="agent-view" aria-label="Plain-text report for agents">${esc(agentView)}</pre>
${shareSection(score)}
</div>
${rail}
</div>

<fieldset class="viewtoggle"><legend class="vh">View</legend><label><input type="radio" name="view" id="v-human">human</label><label><input type="radio" name="view" id="v-agent">agent</label></fieldset>
</main>

<footer class="foot"><div class="wrap">
<p>Generated by <span class="mono">${toolLabel}</span> on ${esc(scannedAt)}. The score counts scored checks only; warnings and skips are listed but don't change it.</p>
<div class="foot-links"><a href="${CHECKS_DOC_URL}" rel="noopener">Check reference</a><a href="${REPO_URL}" rel="noopener">${REPO_URL.replace('https://', '')}</a></div>
</div></footer>
${fixDialog(report, views, gains, score)}
</div>
<script>${REPORT_JS}</script>
</body>
</html>`;
}

export function formatHtml(report: Report, opts: HtmlOptions = {}): string {
  return renderHtml(report, formatMarkdown(report), opts);
}

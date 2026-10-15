import { checks } from '../../src/registry';
import { escapeHtml as esc, resolveScore } from '../../src/report-html';
import type { Category, CheckResult, Report, Status } from '../../src/types';
import { VERSION } from '../../src/version';
import { INSTALL_CMD, MARKDOWN_PAGES, NPM_PACKAGE, REPO_URL, SITE_URL } from './config';

export { REPO_URL };
const CHECKS_DOC_URL = `${REPO_URL}/blob/main/docs/checks.md`;
const ISSUES_URL = `${REPO_URL}/issues`;
const LOCAL_SCAN_CMD = 'agent-readiness http://localhost:3000';

const CATEGORY_LABEL: Record<Category, string> = {
  discoverability: 'Discoverability',
  content: 'Content',
  'bot-access': 'Bot access',
  capabilities: 'Capabilities',
  commerce: 'Commerce',
};
const CATEGORY_ORDER: Category[] = ['discoverability', 'content', 'bot-access', 'capabilities', 'commerce'];

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Crect x='1' y='1' width='20' height='20' rx='6' fill='%23fff' stroke='%23111' stroke-width='1.6'/%3E%3Cpath d='M7 11.5l2.6 2.6L15 8.6' fill='none' stroke='%232349D1' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const BRAND = '<a class="brand" href="/" aria-label="agent-readiness home"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="6" stroke="currentColor" stroke-width="1.6"></rect><path class="tick" d="M7 11.5l2.6 2.6L15 8.6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>agent-readiness</a>';

const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2"></rect><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"></path></svg>';

const GLYPH: Record<Status, string> = {
  pass: '<path d="M3 8.5l3.2 3.2L13 5"></path>',
  fail: '<path d="M4 4l8 8M12 4l-8 8"></path>',
  warn: '<path d="M8 3v6.5M8 12.6v.4"></path>',
  skip: '<path d="M4 8h8"></path>',
};

function termLine(cmd: string, highlight?: string): string {
  const shown = highlight && cmd.startsWith(highlight)
    ? `<span class="c">${esc(highlight)}</span>${esc(cmd.slice(highlight.length))}`
    : esc(cmd);
  return `<div class="term-line"><span class="pr">$</span><code>${shown}</code><button class="btn" type="button" data-copy="${esc(cmd)}" aria-label="Copy command">${COPY_ICON}<span data-label>Copy</span></button></div>`;
}

function layout(opts: { title: string; description: string; body: string; path: string; noindex?: boolean; jsonLd?: object }): string {
  const md = MARKDOWN_PAGES[opts.path];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
${opts.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${opts.path}">
${opts.noindex ? '' : `<link rel="canonical" href="${SITE_URL}${opts.path}">\n`}<link rel="icon" href="${FAVICON}">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
${md ? `<link rel="alternate" type="text/markdown" href="${md}" title="Markdown version">\n` : ''}${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>\n` : ''}<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<div class="ar">
<header class="nav"><div class="wrap">
${BRAND}
<nav class="nav-links" aria-label="Main">
<a href="${CHECKS_DOC_URL}" rel="noopener">Checks</a>
<a href="/example/">Example report</a>
<a href="${REPO_URL}" rel="noopener">GitHub</a>
<a class="btn sm" href="/#install">Install CLI</a>
</nav>
</div></header>
${opts.body}
<footer class="foot"><div class="wrap">
<span>agent-readiness · MIT licensed</span>
<div class="foot-links"><a href="${CHECKS_DOC_URL}" rel="noopener">Checks</a><a href="${REPO_URL}#readme" rel="noopener">Docs</a><a href="${REPO_URL}" rel="noopener">GitHub</a><a href="${ISSUES_URL}" rel="noopener">Report an issue</a></div>
</div></footer>
</div>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function installBlock(id = 'install'): string {
  return `<div class="term" id="${id}">
<div class="term-h"><b>The same scan, from your terminal</b><span>Node 20+ or Bun · JSON, HTML and Markdown output</span></div>
<div class="term-box">
${termLine(INSTALL_CMD)}
${termLine(LOCAL_SCAN_CMD, 'agent-readiness')}
</div>
</div>`;
}

function scanForm(): string {
  return `<form class="scan" action="/scan/" method="get">
<label class="vh" for="scan-url">Website URL</label>
<span class="scan-ic"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7.5"></circle><path d="M2.5 10h15M10 2.5c2.2 2.3 3.2 4.8 3.2 7.5s-1 5.2-3.2 7.5M10 2.5C7.8 4.8 6.8 7.3 6.8 10s1 5.2 3.2 7.5"></path></svg></span>
<input id="scan-url" name="url" type="url" required placeholder="https://your-site.com" autocomplete="url">
<button class="btn primary" type="submit">Scan site</button>
</form>
<p class="scan-note">No sign-up. Hosted scans are rolling out; the CLI below runs the same checks today.</p>
<p class="scan-err" role="status">Enter a full URL, including https:// or http://localhost.</p>`;
}

function badgeIcon(status: Status): string {
  return `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[status]}</svg>`;
}

function band(grade: string): Status {
  if (grade.startsWith('A') || grade === 'B') return 'pass';
  if (grade === 'C' || grade === 'D') return 'warn';
  return 'fail';
}

function exampleResult(report: Report): string {
  const score = resolveScore(report);
  if (!score) throw new Error('example report needs scored checks');
  const status = band(score.grade);
  const warns = report.checks.filter((c) => c.status === 'warn').length;
  const skips = report.checks.filter((c) => c.status === 'skip').length;
  const host = new URL(report.target).host;

  const cats = CATEGORY_ORDER.map((cat) => {
    const s = report.summary[cat];
    if (!s || s.total === 0) return '';
    const seg = `${'<i data-status="pass"></i>'.repeat(s.pass)}${'<i data-status="fail"></i>'.repeat(s.fail)}`;
    return `<div class="cat"><span class="cat-name">${CATEGORY_LABEL[cat]}</span><span class="cat-score">${s.pass}<span>/${s.total}</span></span><span class="seg" aria-hidden="true">${seg}</span></div>`;
  }).join('');

  const topFails = report.checks
    .filter((c: CheckResult) => c.status === 'fail' && c.scored !== false)
    .slice(0, 3)
    .map(
      (c) => `<div class="fixrow" data-status="fail"><span class="badge">${badgeIcon('fail')}FAIL</span><b>${esc(c.title)}</b><span class="m">${esc(c.message)}</span><a href="/example/#cat-${c.category}">How to fix</a></div>`,
    )
    .join('');

  return `<div class="result">
<div class="res-top">
<div class="ring" data-status="${status}">
<progress value="${score.value}" max="100" aria-label="Example score ${score.value} of 100, grade ${esc(score.grade)}" style="--value: ${score.value}"></progress>
<div class="ring-c" aria-hidden="true"><div class="ring-num" data-n="${score.value}"><span>${score.value}</span></div><div class="ring-of">/ 100</div><div class="grade">Grade <b>${esc(score.grade)}</b></div></div>
</div>
<div class="res-meta">
<p class="res-target"><span>https://</span>${esc(host)}</p>
<p class="res-sub">${score.passed} of ${score.total} scored checks passing · ${warns} warnings · ${skips} skipped</p>
<div class="res-actions">
<a class="btn primary" href="/example/">View full report</a>
<a class="btn" href="/example/report.json" download>Download report.json</a>
</div>
</div>
</div>
<div class="cats">${cats}</div>
<div class="topfix">
<span class="topfix-h">Fix these first</span>
${topFails}
</div>
</div>`;
}

interface Pillar {
  label: string;
  question: string;
  description: string;
  probes: Array<[method: string, what: string, result: string, status: Status]>;
  ids: string;
}

const PILLARS: Pillar[] = [
  {
    label: 'Discoverability',
    question: 'Can an agent find you?',
    description: "Agents don't guess URLs. They read robots.txt, your sitemap and well-known links to learn what exists and where.",
    probes: [
      ['GET', '/robots.txt', '200', 'pass'],
      ['GET', '/sitemap.xml', '200', 'pass'],
      ['GET', '/ → Link: rel="api-catalog"', 'missing', 'fail'],
    ],
    ids: 'robots-txt · sitemap · link-header-api-catalog · dns-aid',
  },
  {
    label: 'Content',
    question: 'Can an agent read you?',
    description: 'Pages come back as clean Markdown when asked, and llms.txt points agents to what matters.',
    probes: [
      ['GET', '/  Accept: text/markdown', 'text/markdown', 'pass'],
      ['GET', '/llms.txt', '200', 'pass'],
    ],
    ids: 'markdown-negotiation · llms-txt',
  },
  {
    label: 'Bot access',
    question: 'Are agents welcome, and can they prove who they are?',
    description: 'You state how AI may use your content, set rules per bot, and publish keys so signed agents can verify.',
    probes: [
      ['GET', '/ → Content-Signal', 'ai-train=no', 'pass'],
      ['GET', '/robots.txt → GPTBot, ClaudeBot', 'rules found', 'pass'],
      ['GET', '/.well-known/http-message-signatures-directory', '404', 'fail'],
    ],
    ids: 'content-signal · ai-bot-rules · bot-policy-matrix · web-bot-auth',
  },
  {
    label: 'Capabilities',
    question: 'Can an agent use you, not just read you?',
    description: 'APIs, tools and auth are described in machine-readable cards, so an agent can call them directly.',
    probes: [
      ['GET', '/.well-known/api-catalog', '404', 'fail'],
      ['GET', '/.well-known/mcp/server-card.json', 'text/html', 'fail'],
      ['GET', '/.well-known/agent-card.json', '200', 'pass'],
      ['GET', '/.well-known/oauth-authorization-server', '200', 'pass'],
    ],
    ids: 'api-catalog · mcp-server-card · a2a-agent-card · agent-skills · oauth-* · webmcp',
  },
  {
    label: 'Commerce',
    question: 'Can an agent buy from you?',
    description: 'Shopping agents need your catalog, a checkout, and a payment challenge they understand. Run with --commerce-url.',
    probes: [
      ['GET', '/.well-known/ucp', '200', 'pass'],
      ['GET', '/api/premium → 402 x402', 'valid', 'pass'],
      ['GET', '/api/premium → MPP challenge', 'missing', 'warn'],
    ],
    ids: 'ucp · x402 · mpp',
  },
];

function pillarsSection(host: string): string {
  const tabs = PILLARS.map(
    (p, i) => `<label class="tab"><input type="radio" name="pillar" id="p${i + 1}"><span class="tab-n">[0${i + 1}]</span><span class="tab-t">${p.label}</span><span class="tab-q">${esc(p.question)}</span></label>`,
  ).join('\n');
  const panels = PILLARS.map((p, i) => {
    const lines = p.probes
      .map(([m, what, r, s]) => `<li data-status="${s}"><span class="m">${m}</span><span class="u">${esc(what)}</span><span class="r">${esc(r)}</span></li>`)
      .join('');
    return `<div class="panel" data-p="${i + 1}">
<div class="panel-h"><span class="tab-n">[0${i + 1}] ${p.label}</span><h3>${esc(p.question)}</h3><p>${esc(p.description)}</p></div>
<div class="probe" aria-label="What an agent requests">
<div class="probe-h"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>example probe · ${esc(host)}</span></div>
<ol class="probe-l">${lines}</ol>
</div>
<p class="panel-ids"><span>Checks</span> ${esc(p.ids)}</p>
</div>`;
  }).join('\n');
  return `<section class="wrap block">
<div class="sec-h"><h2>What “agent ready” means</h2><a href="${CHECKS_DOC_URL}" rel="noopener">Read the full check reference →</a></div>
<div class="pillars">
<fieldset class="tabs"><legend class="vh">Five questions an agent asks</legend>
${tabs}
</fieldset>
<div class="panels">
${panels}
</div>
</div>
</section>`;
}

export function renderLanding(report: Report, updated: string): string {
  const host = new URL(report.target).host;
  const body = `<main>
<section class="wrap hero">
<span class="pill">Open source · MIT · runs on localhost too</span>
<h1 class="big">Can AI agents actually use your site?</h1>
<p class="lede">Score any URL against ${checks.length} checks for discovery, content, bot access, capabilities and commerce. Every failure comes with a fix and a command to verify it.</p>
${scanForm()}
${installBlock()}
</section>

<section class="wrap block">
<div class="sec-h"><h2>What you get back</h2><p>Example result for <span class="mono">${esc(host)}</span></p></div>
${exampleResult(report)}
</section>

${pillarsSection(host)}

<section class="wrap block">
<div class="ci">
<div class="ci-copy">
<h2>Gate it in CI</h2>
<p>Scan every preview deploy, fail the build only when something regresses, and attach the HTML report to the PR.</p>
<ul>
<li>Works on localhost, staging and production</li>
<li>One self-contained HTML file, no external requests</li>
<li><span class="mono">--baseline</span> fails only on new regressions</li>
</ul>
</div>
<pre class="ci-code"><span class="cm"># once, on main: save a baseline</span>
<span class="c">agent-readiness</span> $PROD_URL --format json &gt; readiness-baseline.json

<span class="cm"># every PR: exit 1 only on pass → fail regressions</span>
<span class="c">agent-readiness</span> $PREVIEW_URL --baseline readiness-baseline.json

<span class="cm"># human report for the PR artifact</span>
<span class="c">agent-readiness</span> $PREVIEW_URL --format html &gt; agent-readiness.html</pre>
</div>
</section>
</main>`;
  return layout({
    title: 'agent-readiness · Can AI agents use your site?',
    description: `Open-source CLI that scores any URL, including localhost, against ${checks.length} AI-agent readiness checks, with a fix and a verify command for every failure.`,
    body,
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'agent-readiness',
      description: `Open-source CLI that scores any URL against ${checks.length} AI-agent readiness checks and gives a fix for every failure.`,
      url: `${SITE_URL}/`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux, Windows (Node.js 20+ or Bun)',
      softwareVersion: VERSION,
      license: 'https://opensource.org/licenses/MIT',
      codeRepository: REPO_URL,
      downloadUrl: `https://www.npmjs.com/package/${NPM_PACKAGE}`,
      dateModified: updated,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  });
}

/** Placeholder until the hosted scanner ships: echoes the URL as a ready-to-run CLI command. */
export function renderScanPage(): string {
  const body = `<main>
<section class="wrap scan-page">
<span class="pill">Hosted scans are rolling out</span>
<h1 class="big">Run this scan from your terminal</h1>
<p class="lede">The hosted scanner isn't live yet. The CLI runs the same ${checks.length} checks today, on production, staging or localhost.</p>
${scanForm()}
<div class="term">
<div class="term-h"><b>Your scan</b><span>Node 20+ or Bun</span></div>
<div class="term-box">
${termLine(INSTALL_CMD)}
<div class="term-line"><span class="pr">$</span><code id="scan-cmd">agent-readiness https://your-site.com</code><button class="btn" type="button" id="scan-copy" data-copy="agent-readiness https://your-site.com" aria-label="Copy command">${COPY_ICON}<span data-label>Copy</span></button></div>
</div>
</div>
<a class="back" href="/example/">See an example report →</a>
</section>
</main>
<script>(() => {
  const raw = new URLSearchParams(location.search).get('url');
  if (!raw) return;
  let url;
  try { url = new URL(raw); } catch { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const cmd = 'agent-readiness ' + url.href;
  document.getElementById('scan-cmd').textContent = cmd;
  document.getElementById('scan-copy').dataset.copy = cmd;
  document.getElementById('scan-url').value = url.href;
})();</script>`;
  return layout({
    title: 'Scan a site · agent-readiness',
    description: 'Run an agent-readiness scan from your terminal.',
    body,
    path: '/scan/',
    noindex: true,
  });
}

export function renderNotFound(): string {
  const body = `<main>
<section class="wrap scan-page">
<span class="pill">404</span>
<h1 class="big">Nothing here</h1>
<p class="lede">That page doesn't exist. An agent would have hit the same dead end.</p>
<a class="btn primary" href="/">Back to the scanner</a>
</section>
</main>`;
  return layout({ title: 'Not found · agent-readiness', description: 'Page not found.', body, path: '/404.html', noindex: true });
}

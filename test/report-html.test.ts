import { describe, expect, it } from 'bun:test';

import { formatHtml, highlightJson, pointGains, resolveScore } from '../src/report-html';
import { minifyCss } from '../src/report-html/minify';
import type { Category, CheckResult, Report, Status } from '../src/types';

function check(id: string, category: Category, status: Status, extra: Partial<CheckResult> = {}): CheckResult {
  return {
    id,
    category,
    title: `Title ${id}`,
    status,
    message: `Message ${id}`,
    spec: { url: `https://spec.example/${id}`, asOf: '2026-10-01' },
    evidence: {},
    scored: true,
    ...extra,
  };
}

function report(checks: CheckResult[], extra: Partial<Report> = {}): Report {
  const summary = {} as Report['summary'];
  for (const cat of ['discoverability', 'content', 'bot-access', 'capabilities', 'commerce'] as Category[]) {
    const scored = checks.filter((c) => c.category === cat && c.scored !== false && (c.status === 'pass' || c.status === 'fail'));
    summary[cat] = {
      pass: scored.filter((c) => c.status === 'pass').length,
      fail: scored.filter((c) => c.status === 'fail').length,
      total: scored.length,
    };
  }
  return {
    version: 1,
    target: 'https://shop.example.com/',
    scannedAt: '2026-10-14T09:42:18.000Z',
    tool: { name: 'agent-readiness', version: '0.0.1' },
    summary,
    checks,
    ...extra,
  };
}

// 14 pass / 5 fail scored → 74 (C), plus unscored warn and skip.
const sample = report([
  ...Array.from({ length: 14 }, (_, i) => check(`pass-${i}`, i < 7 ? 'content' : 'capabilities', 'pass')),
  check('api-catalog', 'discoverability', 'fail', {
    evidence: {
      request: { method: 'GET', url: 'https://shop.example.com/.well-known/api-catalog' },
      response: { status: 404, contentType: 'text/html; charset=utf-8', bytes: 1243 },
    },
    remediation: { suggestion: 'Serve a Linkset.', verifyCommand: 'curl -sI https://shop.example.com/.well-known/api-catalog', promptPath: 'prompts/api-catalog.md' },
  }),
  check('link-header-api-catalog', 'discoverability', 'fail'),
  check('web-bot-auth', 'bot-access', 'fail'),
  check('mcp-server-card', 'capabilities', 'fail'),
  check('ucp', 'commerce', 'fail'),
  check('webmcp', 'capabilities', 'warn', { scored: false }),
  check('browser-agentic', 'capabilities', 'skip', { scored: false }),
]);

describe('html report', () => {
  const html = formatHtml(sample);

  it('is self-contained: no external stylesheets, scripts, images or fonts', () => {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/i);
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });

  it('renders the score ring, grade and verdict', () => {
    expect(resolveScore(sample)).toEqual({ value: 74, grade: 'C', passed: 14, total: 19 });
    expect(html).toContain('<progress value="74" max="100"');
    expect(html).toContain('data-n="74"');
    expect(html).toContain('Grade <b>C</b>');
    expect(html).toContain('C · Partly agent-ready');
    expect(html).toContain('5 scored checks failing');
  });

  it('prefers report.score when the scanner provides one', () => {
    const withScore = formatHtml({ ...sample, score: { value: 91, grade: 'A', passed: 10, total: 11 } });
    expect(withScore).toContain('<progress value="91"');
    expect(withScore).toContain('A · Agent-ready');
  });

  it('distributes point gains so they add up to exactly 100 minus the score', () => {
    const fails = sample.checks.filter((c) => c.status === 'fail');
    const gains = pointGains(fails, resolveScore(sample));
    expect([...gains.values()].reduce((a, b) => a + b, 0)).toBe(26);
    expect(html).toContain('<span class="gain">+6 pts</span>');
    expect(html).toContain('<span class="gain">+5 pts</span>');
  });

  it('sorts failures first, tags unscored findings and opens evidence for the first failure', () => {
    const first = html.indexOf('data-status="fail"><span class="badge">');
    const pass = html.indexOf('data-status="pass"><span class="badge">');
    expect(first).toBeGreaterThan(-1);
    expect(html).toContain('Bonus · not scored');
    expect(html).toContain('<details class="ev" open>');
    expect(html).toContain('<span class="r">404</span>');
    expect(pass).toBeGreaterThan(-1);
  });

  it('builds the Fix with AI dialog from scored failures plus bonus findings', () => {
    expect(html).toContain('<dialog id="fix" class="fixdlg"');
    expect(html).toContain('style="--score: 74"');
    expect(html).toContain('data-total="6"');
    const data = JSON.parse(/<script type="application\/json" id="fix-data">([\s\S]*?)<\/script>/.exec(html)![1]);
    expect(Object.keys(data.checks).sort()).toEqual(
      ['api-catalog', 'link-header-api-catalog', 'mcp-server-card', 'ucp', 'web-bot-auth', 'webmcp'].sort(),
    );
    expect(data.checks['api-catalog'].prompt).toBe('prompts/api-catalog.md');
  });

  it('escapes check content everywhere, including the embedded JSON', () => {
    const evil = formatHtml(
      report([
        check('x', 'content', 'fail', {
          title: '<img src=x onerror=alert(1)>',
          message: '</script><script>alert(1)</script>',
          evidence: { note: '<b>"quoted"</b>' },
        }),
      ]),
    );
    expect(evil).not.toContain('<img src=x');
    expect(evil).not.toContain('<script>alert(1)</script>');
    expect(evil).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(evil).toContain('\\u003c/script>');
  });

  it('shows an informational state when no scored checks ran', () => {
    const info = formatHtml(report([check('dns-aid', 'discoverability', 'warn', { scored: false })]));
    expect(info).toContain('class="ring empty"');
    expect(info).toContain('No scored checks ran');
    expect(info).toContain('Informational');
    expect(info).not.toContain('<dialog');
  });

  it('renders the crawl table when crawl data exists', () => {
    const crawled = formatHtml({
      ...sample,
      crawl: { pages: ['https://shop.example.com/a', 'https://shop.example.com/b'], perCheck: { 'pass-0': { pass: 1, warn: 0, fail: 1 } } },
    });
    expect(crawled).toContain('id="crawl"');
    expect(crawled).toContain('Across 2 sampled pages');
    expect(crawled).toContain('<span class="rate-v">50%</span>');
    expect(html).not.toContain('id="crawl"');
  });

  it('only shows filter chips for statuses that occur', () => {
    const allPass = formatHtml(report([check('a', 'content', 'pass')]));
    expect(allPass).toContain('id="f-pass"');
    expect(allPass).not.toContain('id="f-fail"');
  });
});

describe('html report head metadata', () => {
  const ld = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);

  it('describes the report with JSON-LD, a meta description and Open Graph tags', () => {
    const html = formatHtml(sample);
    const data = ld(html);
    expect(data['@type']).toBe('Report');
    expect(data.datePublished).toBe(sample.scannedAt);
    expect(data.about).toEqual({ '@type': 'WebSite', url: sample.target });
    expect(data.creator.softwareVersion).toBe(sample.tool.version);
    const description = html.match(/<meta name="description" content="([^"]*)">/)![1];
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description).toContain('74/100');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:description"');
  });

  it('adds a canonical link only when the publish URL is known', () => {
    expect(formatHtml(sample)).not.toContain('rel="canonical"');
    const html = formatHtml(sample, { canonicalUrl: 'https://reports.example.com/shop/' });
    expect(html).toContain('<link rel="canonical" href="https://reports.example.com/shop/">');
    expect(ld(html).url).toBe('https://reports.example.com/shop/');
  });

  it('keeps a hostile target inside the JSON-LD script and attributes', () => {
    const html = formatHtml({ ...sample, target: 'https://x.test/</script><script>alert(1)</script>"' });
    expect(html).not.toContain('</script><script>alert(1)');
    expect(ld(html).about.url).toBe('https://x.test/</script><script>alert(1)</script>"');
  });
});

describe('highlightJson', () => {
  it('tints keys, strings and numbers and escapes markup', () => {
    const out = highlightJson({ status: 404, note: '<x>' });
    expect(out).toContain('<span class="j-k">&quot;status&quot;</span>:');
    expect(out).toContain('<span class="j-n">404</span>');
    expect(out).toContain('<span class="j-s">&quot;&lt;x&gt;&quot;</span>');
  });
});

describe('minifyCss', () => {
  it('drops comments and whitespace but keeps strings and descendant combinators', () => {
    const css = `/* note */\n.ar :is(.row, .group) {\n  color: red;\n  &::before { content: " of  \\B7 "; }\n}\n`;
    expect(minifyCss(css)).toBe('.ar :is(.row,.group){color:red;&::before{content:" of  \\B7 "}}');
  });
});

import { checks } from '../../src/registry';
import { addRemediation } from '../../src/remediation';
import type { Category, CheckResult, Evidence, Report, Status } from '../../src/types';
import { VERSION } from '../../src/version';

/**
 * The example report shown on the landing page. Check ids, titles, categories and
 * scoring come from the real registry; only statuses, messages and evidence are
 * illustrative, and remediation is attached by the real remediation module.
 */
export const SAMPLE_TARGET = 'https://shop.example.com/';
const ORIGIN = 'https://shop.example.com';

interface Outcome {
  status: Status;
  message: string;
  evidence?: Evidence;
}

function get(path: string, status: number, contentType?: string, bytes?: number): Evidence {
  return {
    request: { method: 'GET', url: `${ORIGIN}${path}` },
    response: { status, contentType, bytes },
  };
}

const OUTCOMES: Record<string, Outcome> = {
  'robots-txt': { status: 'pass', message: 'robots.txt served as text/plain with 6 User-agent groups and a Sitemap directive', evidence: get('/robots.txt', 200, 'text/plain', 612) },
  sitemap: { status: 'pass', message: 'Valid XML sitemap with 184 URLs', evidence: get('/sitemap.xml', 200, 'application/xml', 18_204) },
  'link-header-api-catalog': { status: 'fail', message: 'Root response has no Link header with rel="api-catalog"', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'sitemap-lastmod': { status: 'pass', message: '176 of 184 sitemap URLs (96%) have <lastmod>', evidence: get('/sitemap.xml', 200, 'application/xml', 18_204) },
  'rss-atom': { status: 'pass', message: 'Atom feed advertised via <link rel="alternate"> and parses as XML', evidence: get('/feed.xml', 200, 'application/atom+xml', 22_516) },
  'agents-md': { status: 'fail', message: 'No AGENTS.md at /AGENTS.md, /agents.md or /.well-known/agents.md', evidence: get('/AGENTS.md', 404, 'text/html; charset=utf-8', 1_243) },
  'agents-txt': { status: 'warn', message: 'No /agents.json or /agents.txt capability declaration', evidence: get('/agents.json', 404, 'text/html; charset=utf-8', 1_243) },
  'openapi-discovery': { status: 'pass', message: 'OpenAPI 3.1 document at /openapi.json', evidence: get('/openapi.json', 200, 'application/json', 31_877) },
  'dns-aid': { status: 'warn', message: 'No SVCB/HTTPS record at _index._agents.shop.example.com', evidence: { note: 'DNS lookup returned NXDOMAIN' } },
  'markdown-negotiation': { status: 'pass', message: 'Returned text/markdown with Vary: Accept', evidence: get('/', 200, 'text/markdown; charset=utf-8', 9_870) },
  'llms-txt': { status: 'pass', message: 'llms.txt has an H1 and 12 curated links', evidence: get('/llms.txt', 200, 'text/plain', 2_140) },
  'llms-full-txt': { status: 'fail', message: 'Not found (HTTP 404)', evidence: get('/llms-full.txt', 404, 'text/html; charset=utf-8', 1_243) },
  'markdown-mirror': { status: 'pass', message: 'Page advertises a markdown mirror at /index.md, served as text/markdown', evidence: get('/index.md', 200, 'text/markdown; charset=utf-8', 9_870) },
  'markdown-link-rel': { status: 'pass', message: 'Page links its markdown variant with <link rel="alternate" type="text/markdown">', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'sitemap-md': { status: 'warn', message: 'No /sitemap.md markdown index', evidence: get('/sitemap.md', 404, 'text/html; charset=utf-8', 1_243) },
  'page-html-quality': { status: 'pass', message: 'Server-rendered HTML with lang, meta description, canonical and 9 headings', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'json-ld': { status: 'fail', message: 'No application/ld+json block with an @type on the page', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'freshness-signals': { status: 'warn', message: 'No datePublished/dateModified, <time datetime> or Last-Modified header', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'semantic-controls': { status: 'pass', message: 'All 41 controls are real links or buttons; every input has a label', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'content-signal': { status: 'pass', message: 'Content-Signal: search=yes, ai-input=yes, ai-train=no', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  'ai-bot-rules': { status: 'pass', message: 'Explicit rules for GPTBot, ClaudeBot and PerplexityBot', evidence: get('/robots.txt', 200, 'text/plain', 612) },
  'bot-policy-matrix': { status: 'pass', message: 'Search allowed · agents allowed · training blocked' },
  'x-robots-tag': { status: 'pass', message: 'No X-Robots-Tag directives that block indexing or AI use', evidence: get('/', 200, 'text/html; charset=utf-8', 48_311) },
  tdmrep: { status: 'warn', message: 'No TDM-Reservation header, /.well-known/tdmrep.json or /ai.txt', evidence: get('/.well-known/tdmrep.json', 404, 'text/html; charset=utf-8', 1_243) },
  'bot-ua-differential': { status: 'fail', message: 'Browser UA got 200 but GPTBot and ClaudeBot got 403', evidence: { request: { method: 'GET', url: `${ORIGIN}/`, headers: { 'User-Agent': 'GPTBot/1.2' } }, response: { status: 403, contentType: 'text/html; charset=utf-8', bytes: 3_120 } } },
  'web-bot-auth': { status: 'fail', message: '/.well-known/http-message-signatures-directory returned 404', evidence: get('/.well-known/http-message-signatures-directory', 404, 'text/html; charset=utf-8', 1_243) },
  'a2a-agent-card': { status: 'pass', message: 'Agent Card is valid JSON with 3 skills', evidence: get('/.well-known/agent-card.json', 200, 'application/json', 1_902) },
  'agent-skills': { status: 'pass', message: 'Skills index lists 2 skills', evidence: get('/.well-known/agent-skills/index.json', 200, 'application/json', 744) },
  'api-catalog': { status: 'fail', message: '/.well-known/api-catalog returned 404', evidence: get('/.well-known/api-catalog', 404, 'text/html; charset=utf-8', 1_243) },
  'oauth-authorization-server': { status: 'pass', message: 'Metadata includes issuer, token endpoint and PKCE S256', evidence: get('/.well-known/oauth-authorization-server', 200, 'application/json', 1_388) },
  'oauth-protected-resource': { status: 'pass', message: 'Resource metadata lists 1 authorization server', evidence: get('/.well-known/oauth-protected-resource', 200, 'application/json', 402) },
  'mcp-server-card': { status: 'fail', message: 'Returned 200 but content-type "text/html; charset=utf-8", not JSON (likely SPA fallthrough)', evidence: get('/.well-known/mcp/server-card.json', 200, 'text/html; charset=utf-8', 48_311) },
  webmcp: { status: 'warn', message: '/.well-known/webmcp not found', evidence: get('/.well-known/webmcp', 404, 'text/html; charset=utf-8', 1_243) },
  'auth-md': { status: 'pass', message: 'auth.md describes agent registration', evidence: get('/auth.md', 200, 'text/markdown', 3_018) },
  'mcp-server-discover': { status: 'skip', message: 'No --mcp-url given' },
  'browser-agentic': { status: 'skip', message: 'Lighthouse 13.3+ not found on PATH; pass --browser with Lighthouse installed' },
  ucp: { status: 'pass', message: 'UCP profile declares catalog and checkout', evidence: get('/.well-known/ucp', 200, 'application/json', 2_660) },
  x402: { status: 'pass', message: 'Paid resource returned 402 with a valid x402 v2 challenge', evidence: get('/api/premium', 402, 'application/json', 512) },
  mpp: { status: 'warn', message: 'No WWW-Authenticate: Payment challenge on the paid resource', evidence: get('/api/premium', 402, 'application/json', 512) },
};

const CATEGORIES: Category[] = ['discoverability', 'content', 'bot-access', 'capabilities', 'commerce'];

export function sampleReport(): Report {
  const results: CheckResult[] = checks.map((check) => {
    const outcome = OUTCOMES[check.id];
    if (!outcome) throw new Error(`sample report has no outcome for check "${check.id}"`);
    const result: CheckResult = {
      id: check.id,
      category: check.category,
      title: check.title,
      status: outcome.status,
      message: outcome.message,
      spec: check.spec,
      evidence: outcome.evidence ?? {},
    };
    return { ...addRemediation(result, SAMPLE_TARGET), scored: check.scored };
  });

  const summary = {} as Report['summary'];
  for (const cat of CATEGORIES) {
    const scored = results.filter((r) => r.category === cat && r.scored && (r.status === 'pass' || r.status === 'fail'));
    summary[cat] = {
      pass: scored.filter((r) => r.status === 'pass').length,
      fail: scored.filter((r) => r.status === 'fail').length,
      total: scored.length,
    };
  }

  return {
    version: 1,
    target: SAMPLE_TARGET,
    scannedAt: '2026-10-14T09:42:18.000Z',
    tool: { name: 'agent-readiness', version: VERSION },
    summary,
    checks: results,
  };
}

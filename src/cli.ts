#!/usr/bin/env node
import { createHttpClient } from './http';
import { createTarget } from './target';
import { scan } from './scanner';
import { formatHuman, formatJson, formatMarkdown } from './report';
import { checks, PRESETS, SITE_TYPES, EXTERNAL_LOOKUP_CHECKS, MCP_URL_CHECKS, AUTH_MD_CHECKS } from './registry';
import { crawlPages } from './crawl';
import type { Check, SiteType } from './types';
import { compareBaseline, loadBaseline } from './baseline';
import { VERSION } from './version';

type PresetName = 'all' | 'content' | 'api' | 'commerce';

type Format = 'human' | 'json' | 'html' | 'md';

interface Args {
  url?: string;
  contentUrl?: string;
  commerceUrl?: string;
  mcpUrl?: string;
  format: Format;
  timeoutMs: number;
  concurrency: number;
  insecure: boolean;
  userAgent?: string;
  headers: Record<string, string>;
  includeLlmsTxt: boolean;
  includeAuthMd: boolean;
  includeAgentsMd: boolean;
  externalLookups: boolean;
  crawl: number;
  browser: boolean;
  verifySkillDigests: boolean;
  baseline?: string;
  preset: PresetName;
  siteType: string;
  only?: string[];
  skip?: string[];
  listChecks: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `Usage: agent-readiness <url> [options]

Options:
  --preset all|content|api|commerce
                                Check group preset (default: all)
  --site-type full|content      content: skip API/auth checks a content site can't have,
                                and leave them out of the score (default: full)
  --only id1,id2,...            Run only these check IDs (overrides --preset)
  --skip id1,id2,...            Skip these check IDs (applied after preset)
  --list-checks                 List all available checks and exit
  --include-llms-txt            Include the opt-in llms.txt and llms-full.txt checks
  --include-auth-md             Include the API-focused auth.md check
  --include-agents-md           Include the opt-in AGENTS.md check
  --crawl <n>                   Sample up to n sitemap pages and aggregate page-level checks
  --content-url <url>           Page used for content and browser checks
  --commerce-url <url>          Paid resource used for UCP/x402/MPP checks
  --mcp-url <url>               MCP HTTP endpoint used for server/discover
  --browser                     Run Lighthouse Agentic Browsing (requires Node, Lighthouse + Chrome 150+)
  --verify-skill-digests        Fetch Agent Skills artifacts and verify SHA-256 digests
  --external-lookups            Send the site name/domain to third-party directories
                                (MCP registry, Wikidata, npm/PyPI, skills.sh)
  --baseline <report.json>      Exit 1 only when pass/fail checks regress
  --format human|json|html|md   Output format (default: human)
  --timeout <ms>                Per-request timeout (default: 5000)
  --concurrency <n>             Parallel requests (default: 4)
  --insecure                    Skip TLS verification (auto-on for loopback/RFC1918)
  --user-agent <ua>             Spoof User-Agent (e.g. "GPTBot/1.0")
  --header "K: V"               Inject a request header (repeatable)
  --cookie <value>              Send a Cookie header to the target
  --version, -v                 Print the version and exit
  --help, -h                    Show this help
`;

function parseList(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    format: 'human',
    timeoutMs: 5000,
    concurrency: 4,
    insecure: false,
    headers: {},
    includeLlmsTxt: false,
    includeAuthMd: false,
    includeAgentsMd: false,
    externalLookups: false,
    crawl: 0,
    browser: false,
    verifySkillDigests: false,
    preset: 'all',
    siteType: 'full',
    listChecks: false,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--help': case '-h': args.help = true; break;
      case '--version': case '-v': args.version = true; break;
      case '--list-checks': args.listChecks = true; break;
      case '--format': args.format = (argv[++i] ?? 'human') as Format; break;
      case '--timeout': args.timeoutMs = Number(argv[++i]); break;
      case '--concurrency': args.concurrency = Number(argv[++i]); break;
      case '--insecure': args.insecure = true; break;
      case '--include-llms-txt': args.includeLlmsTxt = true; break;
      case '--include-auth-md': args.includeAuthMd = true; break;
      case '--include-agents-md': args.includeAgentsMd = true; break;
      case '--external-lookups': args.externalLookups = true; break;
      case '--crawl': args.crawl = Number(argv[++i]) || 0; break;
      case '--content-url': args.contentUrl = argv[++i]; break;
      case '--commerce-url': args.commerceUrl = argv[++i]; break;
      case '--mcp-url': args.mcpUrl = argv[++i]; break;
      case '--browser': args.browser = true; break;
      case '--verify-skill-digests': args.verifySkillDigests = true; break;
      case '--baseline': args.baseline = argv[++i]; break;
      case '--cookie': args.headers.Cookie = argv[++i] ?? ''; break;
      case '--user-agent': args.userAgent = argv[++i]; break;
      case '--preset': args.preset = (argv[++i] ?? 'all') as PresetName; break;
      case '--site-type': args.siteType = argv[++i] ?? ''; break;
      case '--only': args.only = parseList(argv[++i]); break;
      case '--skip': args.skip = parseList(argv[++i]); break;
      case '--header': {
        const raw = argv[++i] ?? '';
        const idx = raw.indexOf(':');
        if (idx > 0) args.headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
        break;
      }
      default:
        if (a && !a.startsWith('--') && !args.url) args.url = a;
    }
  }
  return args;
}

function selectChecks(all: Check[], args: Args): { selected: Check[]; warnings: string[] } {
  const warnings: string[] = [];
  const knownIds = new Set(all.map((c) => c.id));

  let set: Check[];
  if (args.only && args.only.length) {
    for (const id of args.only) if (!knownIds.has(id)) warnings.push(`unknown check id in --only: ${id}`);
    const onlySet = new Set(args.only);
    set = all.filter((c) => onlySet.has(c.id));
  } else {
    const explicitlyActivated = new Set<string>();
    if (args.includeLlmsTxt) {
      for (const id of ['llms-txt', 'llms-full-txt', 'llms-txt-formatting', 'llms-txt-links-resolve', 'modular-llms-txt']) {
        explicitlyActivated.add(id);
      }
    }
    if (args.includeAuthMd) for (const id of AUTH_MD_CHECKS) explicitlyActivated.add(id);
    if (args.includeAgentsMd) explicitlyActivated.add('agents-md');
    if (args.externalLookups) for (const id of EXTERNAL_LOOKUP_CHECKS) explicitlyActivated.add(id);
    if (args.browser) explicitlyActivated.add('browser-agentic');
    if (args.commerceUrl) {
      explicitlyActivated.add('ucp');
      explicitlyActivated.add('x402');
      explicitlyActivated.add('mpp');
      explicitlyActivated.add('acp-support');
      explicitlyActivated.add('acp-delegate-payment');
      explicitlyActivated.add('ap2-support');
    }
    if (args.mcpUrl) for (const id of MCP_URL_CHECKS) explicitlyActivated.add(id);
    set = all.filter((c) => c.defaultEnabled || explicitlyActivated.has(c.id));
    const presetIds = PRESETS[args.preset];
    if (presetIds !== 'all') {
      if (presetIds === undefined) warnings.push(`unknown preset: ${args.preset} (using "all")`);
      else {
        const presetSet = new Set(presetIds);
        set = set.filter((c) => presetSet.has(c.id));
      }
    }
  }

  if (args.skip && args.skip.length) {
    for (const id of args.skip) if (!knownIds.has(id)) warnings.push(`unknown check id in --skip: ${id}`);
    const skipSet = new Set(args.skip);
    set = set.filter((c) => !skipSet.has(c.id));
  }

  return { selected: set, warnings };
}

async function render(report: ReturnType<typeof scan> extends Promise<infer R> ? R : never, format: Format): Promise<string> {
  switch (format) {
    case 'json': return formatJson(report);
    // Loaded on demand so the HTML report stays out of the CLI's main bundle file.
    case 'html': return (await import('./report-html')).formatHtml(report);
    case 'md': return formatMarkdown(report);
    case 'human':
    default: return formatHuman(report);
  }
}

function printChecksList(all: Check[]): void {
  const byCat: Record<string, Check[]> = {};
  for (const c of all) {
    (byCat[c.category] ??= []).push(c);
  }
  console.log('agent-readiness — available checks\n');
  for (const cat of Object.keys(byCat)) {
    console.log(`[${cat}]`);
    for (const c of byCat[cat]) {
      const tag = c.defaultEnabled ? '          ' : ' (opt-in) ';
      console.log(`  ${c.id.padEnd(32)}${tag}${c.title}`);
    }
    console.log('');
  }
  console.log('Presets:');
  console.log('  all       every default-enabled check');
  console.log('  content   discoverability + content + bot-access');
  console.log('  api       capabilities + bot-access + link-header');
  console.log('  commerce  UCP + x402 + MPP (requires --commerce-url)');
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    return 0;
  }
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.listChecks) {
    printChecksList(checks);
    return 0;
  }
  if (!args.url) {
    console.error(HELP);
    return 2;
  }
  if (!SITE_TYPES.includes(args.siteType as SiteType)) {
    console.error(`Unknown --site-type "${args.siteType}". Use one of: ${SITE_TYPES.join(', ')}`);
    return 2;
  }

  let baselineReport;
  if (args.baseline) {
    try { baselineReport = await loadBaseline(args.baseline); }
    catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }
  }

  let target;
  try {
    target = createTarget({ url: args.url, contentUrl: args.contentUrl, headers: args.headers });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  const { selected, warnings } = selectChecks(checks, args);
  for (const w of warnings) console.error(`warning: ${w}`);
  if (selected.length === 0) {
    console.error('No checks selected. Try --list-checks to see available IDs.');
    return 2;
  }

  const http = createHttpClient({
    timeoutMs: args.timeoutMs,
    userAgent: args.userAgent ?? `agent-readiness/${VERSION} (+https://github.com/itaides/agent-readiness)`,
    defaultHeaders: args.headers,
    credentialOrigin: target.origin.origin,
    insecure: args.insecure || target.isLocal,
  });

  try {
    const report = await scan(target, selected, http, {
      concurrency: args.concurrency,
      siteType: args.siteType as SiteType,
      checkOptions: {
        commerceUrl: args.commerceUrl ? new URL(args.commerceUrl, target.origin) : undefined,
        mcpUrl: args.mcpUrl ? new URL(args.mcpUrl, target.origin) : undefined,
        verifySkillDigests: args.verifySkillDigests,
      },
    });
    if (args.crawl > 0) {
      const pageChecks = selected.filter((c) => c.pageScoped);
      report.crawl = await crawlPages(target, pageChecks, http, args.crawl, {
        verifySkillDigests: args.verifySkillDigests,
      });
      if (!report.crawl) console.error('warning: --crawl found no same-origin sitemap URLs to sample');
    }
    const out = await render(report, args.format);
    process.stdout.write(out);
    if (!out.endsWith('\n')) process.stdout.write('\n');
    if (baselineReport) {
      let diff;
      try { diff = compareBaseline(baselineReport, report); }
      catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        return 2;
      }
      for (const id of diff.removed) console.error(`warning: baseline check removed from current scan: ${id}`);
      if (diff.improvements.length) console.error(`baseline improvements: ${diff.improvements.join(', ')}`);
      if (diff.regressions.length) {
        console.error(`baseline regressions: ${diff.regressions.join(', ')}`);
        return 1;
      }
    }
    return 0;
  } catch (err) {
    console.error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Internal error:', err);
    process.exit(3);
  });

#!/usr/bin/env node
import { createHttpClient } from './http';
import { createTarget } from './target';
import { scan } from './scanner';
import { formatHuman, formatJson, formatMarkdown } from './report';
import { checks, PRESETS } from './registry';
import type { Check } from './types';
import { compareBaseline, loadBaseline } from './baseline';

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
  browser: boolean;
  verifySkillDigests: boolean;
  baseline?: string;
  preset: PresetName;
  only?: string[];
  skip?: string[];
  listChecks: boolean;
  help: boolean;
}

const HELP = `Usage: agent-readiness <url> [options]

Options:
  --preset all|content|api|commerce
                                Check group preset (default: all)
  --only id1,id2,...            Run only these check IDs (overrides --preset)
  --skip id1,id2,...            Skip these check IDs (applied after preset)
  --list-checks                 List all available checks and exit
  --include-llms-txt            Include the opt-in llms.txt and llms-full.txt checks
  --include-auth-md             Include the API-focused auth.md check
  --include-agents-md           Include the opt-in AGENTS.md check
  --content-url <url>           Page used for content and browser checks
  --commerce-url <url>          Paid resource used for UCP/x402/MPP checks
  --mcp-url <url>               MCP HTTP endpoint used for server/discover
  --browser                     Run Lighthouse Agentic Browsing (requires Node, Lighthouse + Chrome 150+)
  --verify-skill-digests        Fetch Agent Skills artifacts and verify SHA-256 digests
  --baseline <report.json>      Exit 1 only when pass/fail checks regress
  --format human|json|html|md   Output format (default: human)
  --timeout <ms>                Per-request timeout (default: 5000)
  --concurrency <n>             Parallel requests (default: 4)
  --insecure                    Skip TLS verification (auto-on for loopback/RFC1918)
  --user-agent <ua>             Spoof User-Agent (e.g. "GPTBot/1.0")
  --header "K: V"               Inject a request header (repeatable)
  --cookie <value>              Send a Cookie header to the target
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
    browser: false,
    verifySkillDigests: false,
    preset: 'all',
    listChecks: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--help': case '-h': args.help = true; break;
      case '--list-checks': args.listChecks = true; break;
      case '--format': args.format = (argv[++i] ?? 'human') as Format; break;
      case '--timeout': args.timeoutMs = Number(argv[++i]); break;
      case '--concurrency': args.concurrency = Number(argv[++i]); break;
      case '--insecure': args.insecure = true; break;
      case '--include-llms-txt': args.includeLlmsTxt = true; break;
      case '--include-auth-md': args.includeAuthMd = true; break;
      case '--include-agents-md': args.includeAgentsMd = true; break;
      case '--content-url': args.contentUrl = argv[++i]; break;
      case '--commerce-url': args.commerceUrl = argv[++i]; break;
      case '--mcp-url': args.mcpUrl = argv[++i]; break;
      case '--browser': args.browser = true; break;
      case '--verify-skill-digests': args.verifySkillDigests = true; break;
      case '--baseline': args.baseline = argv[++i]; break;
      case '--cookie': args.headers.Cookie = argv[++i] ?? ''; break;
      case '--user-agent': args.userAgent = argv[++i]; break;
      case '--preset': args.preset = (argv[++i] ?? 'all') as PresetName; break;
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
    if (args.includeLlmsTxt) { explicitlyActivated.add('llms-txt'); explicitlyActivated.add('llms-full-txt'); }
    if (args.includeAuthMd) explicitlyActivated.add('auth-md');
    if (args.includeAgentsMd) explicitlyActivated.add('agents-md');
    if (args.browser) explicitlyActivated.add('browser-agentic');
    if (args.commerceUrl) {
      explicitlyActivated.add('ucp');
      explicitlyActivated.add('x402');
      explicitlyActivated.add('mpp');
    }
    if (args.mcpUrl) explicitlyActivated.add('mcp-server-discover');
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
    userAgent: args.userAgent ?? 'agent-readiness/0.0.1 (+https://github.com/agent-readiness/cli)',
    defaultHeaders: args.headers,
    insecure: args.insecure || target.isLocal,
  });

  try {
    const report = await scan(target, selected, http, {
      concurrency: args.concurrency,
      checkOptions: {
        commerceUrl: args.commerceUrl ? new URL(args.commerceUrl, target.origin) : undefined,
        mcpUrl: args.mcpUrl ? new URL(args.mcpUrl, target.origin) : undefined,
        verifySkillDigests: args.verifySkillDigests,
      },
    });
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

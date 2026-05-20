#!/usr/bin/env node
import { createHttpClient } from './http';
import { createTarget } from './target';
import { scan } from './scanner';
import { formatHuman, formatJson } from './report';
import { checks, PRESETS } from './registry';
import type { Check } from './types';

type PresetName = 'all' | 'content' | 'api';

interface Args {
  url?: string;
  format: 'human' | 'json';
  timeoutMs: number;
  concurrency: number;
  insecure: boolean;
  userAgent?: string;
  headers: Record<string, string>;
  includeLlmsTxt: boolean;
  preset: PresetName;
  only?: string[];
  skip?: string[];
  listChecks: boolean;
  help: boolean;
}

const HELP = `Usage: agent-readiness <url> [options]

Options:
  --preset all|content|api      Check group preset (default: all)
  --only id1,id2,...            Run only these check IDs (overrides --preset)
  --skip id1,id2,...            Skip these check IDs (applied after preset)
  --list-checks                 List all available checks and exit
  --include-llms-txt            Include the opt-in llms.txt check
  --format human|json           Output format (default: human)
  --timeout <ms>                Per-request timeout (default: 5000)
  --concurrency <n>             Parallel requests (default: 4)
  --insecure                    Skip TLS verification (auto-on for loopback/RFC1918)
  --user-agent <ua>             Spoof User-Agent (e.g. "GPTBot/1.0")
  --header "K: V"               Inject a request header (repeatable)
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
    preset: 'all',
    listChecks: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--help': case '-h': args.help = true; break;
      case '--list-checks': args.listChecks = true; break;
      case '--format': args.format = argv[++i] as Args['format']; break;
      case '--timeout': args.timeoutMs = Number(argv[++i]); break;
      case '--concurrency': args.concurrency = Number(argv[++i]); break;
      case '--insecure': args.insecure = true; break;
      case '--include-llms-txt': args.includeLlmsTxt = true; break;
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
    set = all.filter((c) => c.defaultEnabled || (c.id === 'llms-txt' && args.includeLlmsTxt));
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

  let target;
  try {
    target = createTarget({ url: args.url, headers: args.headers });
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
    const report = await scan(target, selected, http, { concurrency: args.concurrency });
    process.stdout.write(args.format === 'json' ? formatJson(report) : formatHuman(report));
    process.stdout.write('\n');
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

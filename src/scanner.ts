import pLimit from 'p-limit';
import type {
  Category,
  CategorySummary,
  Check,
  CheckResult,
  HttpClient,
  Report,
  Target,
  CheckRunOptions,
} from './types';
import { addRemediation } from './remediation';

export interface ScanOptions {
  concurrency: number;
  checkOptions?: Partial<CheckRunOptions>;
}

export async function scan(
  target: Target,
  checks: Check[],
  http: HttpClient,
  opts: ScanOptions,
): Promise<Report> {
  const limit = pLimit(opts.concurrency);
  const checkOptions: CheckRunOptions = {
    verifySkillDigests: false,
    ...opts.checkOptions,
  };
  const rawResults = await Promise.all(
    checks.map((c) =>
      limit(async (): Promise<CheckResult> => {
        try {
          return await c.run(target, http, checkOptions);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            id: c.id,
            category: c.category,
            title: c.title,
            status: 'fail',
            message: `Internal error: ${message}`,
            spec: c.spec,
            evidence: {},
          };
        }
      }),
    ),
  );
  const results = rawResults.map((result) => addRemediation(result, target.origin.toString()));

  return {
    version: 1,
    target: target.origin.toString(),
    scannedAt: new Date().toISOString(),
    tool: { name: 'agent-readiness', version: '0.0.1' },
    summary: buildSummary(results, checks),
    checks: results,
  };
}

const CATEGORIES: Category[] = [
  'discoverability',
  'content',
  'bot-access',
  'capabilities',
  'commerce',
];

function buildSummary(results: CheckResult[], checks: Check[]): Report['summary'] {
  const summary = {} as Report['summary'];
  const scoredIds = new Set(checks.filter((check) => check.scored).map((check) => check.id));
  for (const cat of CATEGORIES) {
    const inCat = results.filter((r) => r.category === cat && scoredIds.has(r.id) && (r.status === 'pass' || r.status === 'fail'));
    summary[cat] = {
      pass: inCat.filter((r) => r.status === 'pass').length,
      fail: inCat.filter((r) => r.status === 'fail').length,
      total: inCat.length,
    };
  }
  return summary;
}

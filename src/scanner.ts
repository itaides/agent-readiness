import pLimit from 'p-limit';
import type {
  Category,
  CategorySummary,
  Check,
  CheckResult,
  HttpClient,
  Report,
  Target,
} from './types';

export interface ScanOptions {
  concurrency: number;
}

export async function scan(
  target: Target,
  checks: Check[],
  http: HttpClient,
  opts: ScanOptions,
): Promise<Report> {
  const limit = pLimit(opts.concurrency);
  const results = await Promise.all(
    checks.map((c) =>
      limit(async (): Promise<CheckResult> => {
        try {
          return await c.run(target, http);
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

  return {
    version: 1,
    target: target.origin.toString(),
    scannedAt: new Date().toISOString(),
    tool: { name: 'agent-readiness', version: '0.0.1' },
    summary: buildSummary(results),
    checks: results,
  };
}

const SCORED_CATEGORIES: Array<Exclude<Category, 'commerce'>> = [
  'discoverability',
  'content',
  'bot-access',
  'capabilities',
];

function buildSummary(results: CheckResult[]): Report['summary'] {
  const summary = {} as Report['summary'];
  for (const cat of SCORED_CATEGORIES) {
    const inCat = results.filter((r) => r.category === cat);
    summary[cat] = {
      pass: inCat.filter((r) => r.status === 'pass').length,
      fail: inCat.filter((r) => r.status === 'fail').length,
      total: inCat.length,
    };
  }
  return summary;
}

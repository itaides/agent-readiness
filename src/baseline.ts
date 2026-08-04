import { readFile } from 'node:fs/promises';
import type { Report, Status } from './types';

export interface BaselineDiff {
  regressions: string[];
  improvements: string[];
  removed: string[];
}

function statusMap(report: Report): Map<string, Status> {
  return new Map(report.checks.map((check) => [check.id, check.status]));
}

export function compareBaseline(baseline: Report, current: Report): BaselineDiff {
  if (baseline.target !== current.target) {
    throw new Error(`Baseline target mismatch: expected ${baseline.target}, got ${current.target}`);
  }

  const before = statusMap(baseline);
  const now = statusMap(current);
  const regressions: string[] = [];
  const improvements: string[] = [];
  const removed: string[] = [];

  for (const [id, status] of now) {
    const previous = before.get(id);
    if ((previous === 'pass' && status === 'fail') || (previous === undefined && status === 'fail')) {
      regressions.push(id);
    }
    if ((previous === 'fail' && status === 'pass') || (previous === undefined && status === 'pass')) {
      improvements.push(id);
    }
  }
  for (const id of before.keys()) {
    if (!now.has(id)) removed.push(id);
  }

  return { regressions, improvements, removed };
}

export async function loadBaseline(path: string): Promise<Report> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read baseline ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Report).checks) || typeof (parsed as Report).target !== 'string') {
    throw new Error(`Invalid baseline report: ${path}`);
  }
  return parsed as Report;
}

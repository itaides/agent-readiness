import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'content-signal',
  category: 'bot-access' as const,
  title: 'Content Signals policy',
  spec: { url: 'https://contentsignals.org/', asOf: '2026-08-04' },
};

const CORE_VALUES: Record<string, Set<string>> = {
  'ai-train': new Set(['yes', 'no']),
  'ai-input': new Set(['yes', 'no']),
  search: new Set(['yes', 'no']),
  use: new Set(['immediate', 'reference', 'full']),
};

interface ParsedSignal {
  source: string;
  values: string[];
  errors: string[];
}

function parseSignal(raw: string, source: string): ParsedSignal {
  const body = raw.replace(/^\s*content-signal\s*:\s*/i, '').trim();
  const parts = body.split(',').map((part) => part.trim()).filter(Boolean);
  const values: string[] = [];
  const errors: string[] = [];
  let currentPath = '*';
  for (const part of parts) {
    const match = part.match(/^(?:(\/\S*)\s+)?([a-z-]+)\s*=\s*([a-z-]+)$/i);
    if (!match) { errors.push(`malformed token "${part}"`); continue; }
    const [, path, keyRaw, valueRaw] = match;
    if (path) currentPath = path;
    const key = keyRaw.toLowerCase();
    const value = valueRaw.toLowerCase();
    const allowed = CORE_VALUES[key];
    if (!allowed) continue;
    if (!allowed.has(value)) errors.push(`${key} has invalid value "${value}"`);
    else values.push(`${currentPath} ${key}=${value}`);
  }
  return { source, values, errors };
}

const contentSignal: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const robotsUrl = new URL('/robots.txt', target.origin).toString();
    const robots = await http.fetch(robotsUrl);
    const robotLines = robots.status === 200
      ? decodeBody(robots.body).split(/\r?\n/).filter((line) => /^\s*content-signal\s*:/i.test(line))
      : [];

    const contentUrl = target.contentUrl.toString();
    const content = await http.fetch(contentUrl, { headers: { Accept: 'text/markdown' } });
    const header = content.headers.get('content-signal');
    const parsed = [
      ...robotLines.map((line, index) => parseSignal(line, `robots.txt line ${index + 1}`)),
      ...(header ? [parseSignal(header, 'Content-Signal response header')] : []),
    ];
    const values = parsed.flatMap((entry) => entry.values);
    const errors = parsed.flatMap((entry) => entry.errors.map((error) => `${entry.source}: ${error}`));
    const evidence: Evidence = {
      request: { method: 'GET', url: contentUrl, headers: { Accept: 'text/markdown' } },
      response: { status: content.status, contentType: content.contentType, bytes: content.body.length, finalUrl: content.finalUrl },
      note: [
        robotLines.length ? `robots.txt: ${robotLines.map((line) => line.trim()).join(' | ')}` : `robots.txt: no directive (HTTP ${robots.status})`,
        header ? `response header: ${header}` : 'response header: absent',
      ].join('; '),
    };

    if (errors.length) return makeResult(META, 'fail', errors.join('; '), evidence);
    if (values.length === 0) return makeResult(META, 'fail', 'No valid Content-Signal policy in robots.txt or the content response header', evidence);
    return makeResult(META, 'pass', `Valid policy: ${values.join(', ')}`, evidence);
  },
};

export default contentSignal;

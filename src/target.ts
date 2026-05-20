import { isIP } from 'node:net';
import type { Target } from './types';

export interface CreateTargetOptions {
  url: string;
  contentUrl?: string;
  headers?: Record<string, string>;
}

export function createTarget(opts: CreateTargetOptions): Target {
  let parsed: URL;
  try { parsed = new URL(opts.url); }
  catch { throw new Error(`Invalid URL: ${opts.url}`); }

  const origin = new URL(parsed.origin);
  const contentUrl = opts.contentUrl ? new URL(opts.contentUrl) : parsed;
  const isLocal = detectLocal(parsed.hostname);

  return { origin, contentUrl, isLocal, headers: opts.headers ?? {} };
}

export function detectLocal(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;

  const stripped = hostname.replace(/^\[|\]$/g, '');
  const family = isIP(stripped);
  if (family === 4) {
    const n = ipv4ToInt(stripped);
    return PRIVATE_V4_RANGES.some((r) => n >= r.first && n <= r.last);
  }
  if (family === 6) {
    const lc = stripped.toLowerCase();
    if (lc === '::1') return true;
    const firstSegment = lc.split(':')[0] ?? '';
    if (firstSegment.startsWith('fc') || firstSegment.startsWith('fd')) return true;
  }
  return false;
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc * 256) + Number(part), 0);
}

const PRIVATE_V4_RANGES = [
  { first: ipv4ToInt('127.0.0.0'),   last: ipv4ToInt('127.255.255.255') },
  { first: ipv4ToInt('10.0.0.0'),    last: ipv4ToInt('10.255.255.255')  },
  { first: ipv4ToInt('172.16.0.0'),  last: ipv4ToInt('172.31.255.255')  },
  { first: ipv4ToInt('192.168.0.0'), last: ipv4ToInt('192.168.255.255') },
];

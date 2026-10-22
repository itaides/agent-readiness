import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchText, makeResult } from './_shared';

// Sends a handful of read-only GET requests carrying well-known AI agent
// user-agents and compares the answer to the baseline fetch.

const USER_AGENTS = {
  'bot-detection': [
    ['ChatGPT-User', 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'],
    ['OAI-SearchBot', 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'],
    ['Claude-User', 'Mozilla/5.0 (compatible; Claude-User/1.0; +https://support.anthropic.com)'],
    ['Perplexity-User', 'Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai)'],
  ],
  'agent-crawler-reachability': [
    ['GPTBot', 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'],
    ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)'],
    ['PerplexityBot', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai)'],
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ],
} as const;

async function probe(target: Target, http: HttpClient, agents: readonly (readonly [string, string])[]) {
  const baseline = await fetchText(target.origin.toString(), http);
  const baselineOk = baseline.status < 400;
  const blocked: string[] = [];
  const statuses: string[] = [];
  for (const [name, ua] of agents) {
    try {
      const res = await fetchText(target.origin.toString(), http, { headers: { 'User-Agent': ua, Accept: 'text/html' } });
      statuses.push(`${name}=${res.status}`);
      const denied = res.status === 401 || res.status === 403 || res.status === 406 || res.status === 429;
      const degraded = baselineOk && res.status >= 500;
      if (denied || degraded) blocked.push(`${name} (HTTP ${res.status})`);
    } catch {
      statuses.push(`${name}=error`);
      if (baselineOk) blocked.push(`${name} (request failed)`);
    }
  }
  const evidence: Evidence = {
    request: { method: 'GET', url: target.origin.toString(), headers: { 'User-Agent': '<AI agent UAs>' } },
    response: { status: baseline.status, contentType: baseline.contentType },
    note: `baseline=${baseline.status}; ${statuses.join(', ')}`,
  };
  return { blocked, baselineStatus: baseline.status, evidence };
}

export const botDetection: Check = {
  id: 'bot-detection',
  category: 'bot-access',
  title: 'Not blocked by bot detection (user agents)',
  spec: { url: 'https://ora.ai/bot', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'bot-detection', category: 'bot-access' as const, title: 'Not blocked by bot detection (user agents)', spec: { url: 'https://ora.ai/bot', asOf: '2026-10-22' } };
    const { blocked, baselineStatus, evidence } = await probe(target, http, USER_AGENTS['bot-detection']);
    if (baselineStatus >= 400) return makeResult(meta, 'skip', `Baseline request failed (HTTP ${baselineStatus})`, evidence);
    if (blocked.length) return makeResult(meta, 'fail', `Blocked user-directed agents: ${blocked.join(', ')}`, evidence);
    return makeResult(meta, 'pass', 'All user-directed agent user-agents reached the homepage', evidence);
  },
};

export const agentCrawlerReachability: Check = {
  id: 'agent-crawler-reachability',
  category: 'bot-access',
  title: 'Agent crawler reachability',
  spec: { url: 'https://ora.ai/bot', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-crawler-reachability', category: 'bot-access' as const, title: 'Agent crawler reachability', spec: { url: 'https://ora.ai/bot', asOf: '2026-10-22' } };
    const { blocked, baselineStatus, evidence } = await probe(target, http, USER_AGENTS['agent-crawler-reachability']);
    if (baselineStatus >= 400) return makeResult(meta, 'skip', `Baseline request failed (HTTP ${baselineStatus})`, evidence);
    if (blocked.length) return makeResult(meta, 'fail', `Crawlers blocked: ${blocked.join(', ')}`, evidence);
    return makeResult(meta, 'pass', 'All AI crawler user-agents reached the homepage', evidence);
  },
};

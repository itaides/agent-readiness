import robotsParser from 'robots-parser';
import type { Check, CheckResult } from '../types';
import { fetchRobots, makeResult } from './_shared';

// Deeper robots.txt policy quality: whether AI search crawlers and
// user-directed agents are permitted to read public pages. Blocking choices
// are preserved — this measures that an explicit, informed stance exists.

const SEARCH_CRAWLERS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];
const USER_AGENTS = ['ChatGPT-User', 'Claude-User', 'Perplexity-User'];

export const robotsAiPolicyQuality: Check = {
  id: 'robots-ai-policy-quality',
  category: 'bot-access',
  title: 'robots.txt AI search crawler policy',
  spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'robots-ai-policy-quality', category: 'bot-access' as const, title: 'robots.txt AI search crawler policy', spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-10-22' } };
    const robots = await fetchRobots(target.origin, http);
    const validRobots = robots.status === 200 && /^\s*user-agent\s*:/im.test(robots.body) && !/^\s*<(!doctype|html)/i.test(robots.body);
    if (!validRobots) return makeResult(meta, 'warn', `robots.txt unavailable or not a real robots file (HTTP ${robots.status})`, robots.evidence);
    const parser = robotsParser(robots.url, robots.body);
    const blocked = SEARCH_CRAWLERS.filter((bot) => parser.isAllowed(target.contentUrl.toString(), bot) === false);
    const explicitAgents = new Set((robots.body.match(/^\s*user-agent\s*:\s*(.+)$/gim) ?? []).map((l) => l.split(':').slice(1).join(':').trim().toLowerCase()));
    robots.evidence.note = `explicit groups: ${SEARCH_CRAWLERS.filter((b) => explicitAgents.has(b.toLowerCase())).join(', ') || 'none (default allow)'}`;
    if (blocked.length) return makeResult(meta, 'warn', `AI search crawlers blocked: ${blocked.join(', ')} — AI search cannot surface this site`, robots.evidence);
    return makeResult(meta, 'pass', `AI search crawlers can read public pages (${SEARCH_CRAWLERS.join(', ')})`, robots.evidence);
  },
};

export const robotsAgentUserPolicy: Check = {
  id: 'robots-agent-user-policy',
  category: 'bot-access',
  title: 'robots.txt agent-user policy',
  spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'robots-agent-user-policy', category: 'bot-access' as const, title: 'robots.txt agent-user policy', spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-10-22' } };
    const robots = await fetchRobots(target.origin, http);
    const validRobots = robots.status === 200 && /^\s*user-agent\s*:/im.test(robots.body) && !/^\s*<(!doctype|html)/i.test(robots.body);
    if (!validRobots) return makeResult(meta, 'warn', `robots.txt unavailable or not a real robots file (HTTP ${robots.status})`, robots.evidence);
    const parser = robotsParser(robots.url, robots.body);
    const verdicts = USER_AGENTS.map((bot) => `${bot}:${parser.isAllowed(target.contentUrl.toString(), bot) === false ? 'blocked' : 'allowed'}`);
    robots.evidence.note = verdicts.join('; ');
    if (verdicts.every((v) => v.endsWith('blocked'))) {
      return makeResult(meta, 'warn', `All user-directed agents blocked (${USER_AGENTS.join(', ')})`, robots.evidence);
    }
    return makeResult(meta, 'pass', verdicts.join('; '), robots.evidence);
  },
};

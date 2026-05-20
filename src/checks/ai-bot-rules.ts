import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'ai-bot-rules',
  category: 'bot-access' as const,
  title: 'AI bot rules in robots.txt',
  spec: { url: 'https://blog.cloudflare.com/agent-readiness/', asOf: '2026-04-17' },
};

const KNOWN_AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Meta-ExternalAgent',
  'Amazonbot',
  'CCBot',
  'cohere-ai',
];

const aiBotRules: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/robots.txt', target.origin).toString();
    const res = await http.fetch(url);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length },
    };

    if (res.status !== 200) return makeResult(META, 'fail', `robots.txt unavailable (HTTP ${res.status})`, evidence);

    const uaLines = bodyText.split(/\r?\n/).filter((l) => /^\s*user-agent\s*:/i.test(l));
    const matched: string[] = [];
    for (const line of uaLines) {
      const value = line.split(':').slice(1).join(':').trim();
      for (const bot of KNOWN_AI_BOTS) {
        if (value.toLowerCase().includes(bot.toLowerCase()) && !matched.includes(bot)) matched.push(bot);
      }
    }

    if (matched.length === 0) {
      return makeResult(META, 'fail', `No User-agent: lines reference any of the ${KNOWN_AI_BOTS.length} known AI bots`, evidence);
    }
    evidence.note = `Matched: ${matched.join(', ')}`;
    return makeResult(META, 'pass', `Rules present for: ${matched.join(', ')}`, evidence);
  },
};

export default aiBotRules;

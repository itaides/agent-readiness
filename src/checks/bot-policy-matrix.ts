import robotsParser from 'robots-parser';
import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'bot-policy-matrix',
  category: 'bot-access' as const,
  title: 'Bot policy matrix (Search / Agent / Training)',
  spec: { url: 'https://developers.cloudflare.com/bots/concepts/bot/verified-bots/', asOf: '2026-08-04' },
};

const BOTS = {
  Search: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot'],
  Agent: ['ChatGPT-User', 'Claude-User', 'Perplexity-User'],
  Training: ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'Meta-ExternalAgent', 'CCBot', 'cohere-ai'],
} as const;

function explicitUserAgents(body: string): Set<string> {
  const values = body.match(/^\s*user-agent\s*:\s*(.+)$/gim) ?? [];
  return new Set(values.map((line) => line.split(':').slice(1).join(':').trim().toLowerCase()));
}

const botPolicyMatrix: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const url = new URL('/robots.txt', target.origin).toString();
    const response = await http.fetch(url);
    const body = decodeBody(response.body);
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: response.status, contentType: response.contentType, bytes: response.body.length },
    };
    if (response.status !== 200) return makeResult(META, 'warn', `robots.txt unavailable (HTTP ${response.status})`, evidence);

    const agents = explicitUserAgents(body);
    const parser = robotsParser(url, body);
    const matrix: string[] = [];
    let explicitCount = 0;
    for (const [behavior, botNames] of Object.entries(BOTS)) {
      const entries = botNames.flatMap((bot) => {
        if (!agents.has(bot.toLowerCase())) return [];
        explicitCount++;
        return [`${bot}:${parser.isAllowed(target.contentUrl.toString(), bot) === false ? 'block' : 'allow'}`];
      });
      matrix.push(`${behavior}=${entries.length ? entries.join('|') : 'unset'}`);
    }
    evidence.note = matrix.join('; ');
    if (explicitCount === 0) return makeResult(META, 'warn', 'No explicit Search, Agent, or Training bot policies found', evidence);
    return makeResult(META, 'pass', matrix.join('; '), evidence);
  },
};

export default botPolicyMatrix;

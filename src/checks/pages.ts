import type { Check, CheckResult } from '../types';
import { fetchPage, fetchText, getEvidence, makeResult } from './_shared';
import { parseHtml } from './_html';

const SPEC = { url: 'https://ora.ai/docs', asOf: '2026-10-22' };

export const agentFriendly404: Check = {
  id: 'agent-friendly-404',
  category: 'content',
  title: 'Agent-friendly 404s',
  spec: SPEC,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-friendly-404', category: 'content' as const, title: 'Agent-friendly 404s', spec: SPEC };
    const url = new URL(`/agent-readiness-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, target.origin).toString();
    const res = await fetchText(url, http);
    const evidence = getEvidence('GET', url, res);
    if (res.status === 404 || res.status === 410) {
      const md = /^text\/(markdown|x-markdown)/i.test(res.contentType);
      return makeResult(meta, 'pass', `Real HTTP ${res.status} for missing paths${md ? ' with a markdown body' : ''}`, evidence);
    }
    if (res.status === 200) return makeResult(meta, 'fail', 'Missing path returns HTTP 200 — soft-404/SWA fallthrough misleads agents and crawlers', evidence);
    return makeResult(meta, 'warn', `Missing path returned HTTP ${res.status}`, evidence);
  },
};

export const redirectHygiene: Check = {
  id: 'redirect-hygiene',
  category: 'content',
  title: 'Redirect hygiene',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'redirect-hygiene', category: 'content' as const, title: 'Redirect hygiene', spec: SPEC };
    const page = await fetchPage(target.contentUrl.toString(), http);
    if (page.status !== 200) return makeResult(meta, 'skip', `Content URL returned HTTP ${page.status}`, page.evidence);
    const doc = parseHtml(page.body);
    const problems: string[] = [];
    if (doc.metaRefresh) problems.push('meta-refresh stub page');
    if (doc.jsOnlyRedirect) problems.push('JavaScript-only redirect');
    const chain = page.evidence.response?.redirectChain ?? [];
    if (chain.length > 2) problems.push(`${chain.length}-hop redirect chain`);
    page.evidence.note = chain.length ? `redirect chain: ${chain.join(' → ')}` : undefined;
    if (problems.length) return makeResult(meta, 'warn', `Redirect issues: ${problems.join('; ')}`, page.evidence);
    if (doc.textLength < 200) return makeResult(meta, 'warn', 'Too little content on the page to evaluate redirect hygiene', page.evidence);
    return makeResult(meta, 'pass', 'Content reachable without meta-refresh, JS-only redirects, or long chains', page.evidence);
  },
};

export const pricingMd: Check = {
  id: 'pricing-md',
  category: 'content',
  title: 'pricing.md exists',
  spec: { url: 'https://agenticweb.ai/pricing-md', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'pricing-md', category: 'content' as const, title: 'pricing.md exists', spec: { url: 'https://agenticweb.ai/pricing-md', asOf: '2026-10-22' } };
    const url = new URL('/pricing.md', target.origin).toString();
    const res = await fetchText(url, http);
    const evidence = getEvidence('GET', url, res);
    const isText = /text\/(plain|markdown|x-markdown)/i.test(res.contentType) && !/^\s*<(!doctype|html)/i.test(res.text);
    if (res.status === 200 && isText && res.text.trim().length > 0) {
      return makeResult(meta, 'pass', 'Machine-readable pricing at /pricing.md', evidence);
    }
    return makeResult(meta, 'warn', `No /pricing.md (HTTP ${res.status})`, evidence);
  },
};

export const pricingInfo: Check = {
  id: 'pricing-info',
  category: 'content',
  title: 'Pricing info accessible',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'pricing-info', category: 'content' as const, title: 'Pricing info accessible', spec: SPEC };
    const page = await fetchPage(target.contentUrl.toString(), http);
    const doc = parseHtml(page.body);
    const link = doc.anchors.find((a) => /pricing|plans|buy/i.test(a.href) || /pricing|plans/i.test(a.text));
    const candidates = [new URL('/pricing', target.origin).toString()];
    if (link) candidates.unshift(new URL(link.href, target.contentUrl).toString());
    for (const url of new Set(candidates)) {
      const res = await fetchText(url, http);
      if (res.status !== 200) continue;
      const hasPrices = /(\$\d|€\d|£\d|\bfree\b|\bper\s+(month|year|seat)\b|\bpricing\b|\bplans\b)/i.test(res.text);
      if (hasPrices) return makeResult(meta, 'pass', `Pricing information readable at ${new URL(url).pathname}`, getEvidence('GET', url, res));
    }
    return makeResult(meta, 'warn', 'No readable pricing page discovered (checked homepage links and /pricing)', {});
  },
};

export const agentModeView: Check = {
  id: 'agent-mode-view',
  category: 'content',
  title: 'Agent mode view (?mode=agent)',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-mode-view', category: 'content' as const, title: 'Agent mode view (?mode=agent)', spec: SPEC };
    const u = new URL(target.contentUrl.toString());
    u.searchParams.set('mode', 'agent');
    const res = await fetchText(u.toString(), http);
    const evidence = getEvidence('GET', u.toString(), res);
    if (res.status !== 200) return makeResult(meta, 'warn', `?mode=agent returned HTTP ${res.status}`, evidence);
    const structured = /^text\/(markdown|plain)/i.test(res.contentType) || /json/i.test(res.contentType);
    const leanHtml = /html/i.test(res.contentType) && parseHtml(res.text).textLength > 100 && res.text.length < 60_000;
    if (structured || leanHtml) return makeResult(meta, 'pass', `Agent view served (${res.contentType})`, evidence);
    return makeResult(meta, 'warn', '?mode=agent returns the same heavy page — no stripped agent view detected', evidence);
  },
};

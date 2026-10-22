import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchPage, fetchText, getEvidence, makeResult, memoize } from './_shared';
import { parseHtml } from './_html';
import { parseLinkHeader } from './ard';

const SPEC = { url: 'https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/', asOf: '2026-10-22' };

// One markdown-variant fetch of the content URL, shared by the family.
function getMarkdown(target: Target, http: HttpClient) {
  return memoize(`md:${target.contentUrl}`, async () => {
    const url = target.contentUrl.toString();
    const res = await fetchText(url, http, { headers: { Accept: 'text/markdown' } });
    return { res, url, evidence: getEvidence('GET', url, res, undefined, { Accept: 'text/markdown' }) };
  });
}

function isMarkdown(res: { contentType: string; text: string }): boolean {
  return /^text\/(markdown|x-markdown)/i.test(res.contentType) && !/^\s*<!doctype|^\s*<html/i.test(res.text);
}

export const markdownUrlFallback: Check = {
  id: 'markdown-url-fallback',
  category: 'content',
  title: 'Markdown URL fallback (.md)',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'markdown-url-fallback', category: 'content' as const, title: 'Markdown URL fallback (.md)', spec: SPEC };
    const candidates = [
      new URL('/index.md', target.origin).toString(),
      target.contentUrl.toString().replace(/\/?$/, '.md'),
    ];
    for (const url of new Set(candidates)) {
      const res = await fetchText(url, http);
      if (res.status === 200 && isMarkdown(res)) {
        return makeResult(meta, 'pass', `Markdown twin served at ${new URL(url).pathname}`, getEvidence('GET', url, res));
      }
    }
    return makeResult(meta, 'warn', 'Appending .md to pages does not return markdown', {});
  },
};

export const markdownLinkAlternate: Check = {
  id: 'markdown-link-alternate',
  category: 'content',
  title: 'Markdown alternate link advertised',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'markdown-link-alternate', category: 'content' as const, title: 'Markdown alternate link advertised', spec: SPEC };
    const page = await fetchPage(target.contentUrl.toString(), http);
    const linkRels = parseLinkHeader(page.headers.get('link') ?? '');
    const doc = parseHtml(page.body);
    const alt = linkRels.find((l) => l.rel === 'alternate' && /markdown/i.test(l.type ?? ''))
      ?? doc.links.find((l) => l.rel.split(/\s+/).includes('alternate') && /markdown/i.test(l.type ?? ''));
    if (!alt) return makeResult(meta, 'warn', 'No rel="alternate" markdown twin advertised', page.evidence);
    const u = new URL(alt.href, target.contentUrl).toString();
    const res = await fetchText(u, http);
    if (res.status === 200 && isMarkdown(res)) return makeResult(meta, 'pass', 'Advertised markdown alternate serves markdown', getEvidence('GET', u, res));
    return makeResult(meta, 'warn', `Advertised markdown alternate ${alt.href} does not serve markdown (HTTP ${res.status}, ${res.contentType})`, getEvidence('GET', u, res));
  },
};

export const markdownNegotiationVary: Check = {
  id: 'markdown-negotiation-vary',
  category: 'content',
  title: 'Markdown negotiation sends Vary: Accept',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'markdown-negotiation-vary', category: 'content' as const, title: 'Markdown negotiation sends Vary: Accept', spec: SPEC };
    const { res, evidence } = await getMarkdown(target, http);
    if (res.status !== 200 || !isMarkdown(res)) return makeResult(meta, 'warn', 'No markdown variant on the content URL to grade', evidence);
    const vary = (res.headers.get('vary') ?? '').toLowerCase();
    if (vary.split(',').map((v) => v.trim()).includes('accept')) {
      return makeResult(meta, 'pass', 'Markdown response carries Vary: Accept (cache-safe negotiation)', evidence);
    }
    return makeResult(meta, 'warn', 'Markdown served without Vary: Accept — caches may serve the wrong variant', evidence);
  },
};

export const agentUaMarkdown: Check = {
  id: 'agent-ua-markdown',
  category: 'bot-access',
  title: 'Bot user-agents served markdown',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-ua-markdown', category: 'bot-access' as const, title: 'Bot user-agents served markdown', spec: SPEC };
    const url = target.contentUrl.toString();
    const res = await fetchText(url, http, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)', Accept: 'text/html' } });
    const evidence = getEvidence('GET', url, res, undefined, { 'User-Agent': 'GPTBot', Accept: 'text/html' });
    if (res.status !== 200) return makeResult(meta, 'warn', `Bot UA request returned HTTP ${res.status}`, evidence);
    if (isMarkdown(res)) return makeResult(meta, 'pass', 'Site serves markdown to AI crawler user-agents proactively', evidence);
    return makeResult(meta, 'warn', `Bot UA got ${res.contentType}, not markdown`, evidence);
  },
};

export const markdownFrontmatter: Check = {
  id: 'markdown-frontmatter',
  category: 'content',
  title: 'Markdown frontmatter metadata',
  spec: { url: 'https://frontmatter.codes/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'markdown-frontmatter', category: 'content' as const, title: 'Markdown frontmatter metadata', spec: { url: 'https://frontmatter.codes/', asOf: '2026-10-22' } };
    const { res, evidence } = await getMarkdown(target, http);
    if (res.status !== 200 || !isMarkdown(res)) return makeResult(meta, 'skip', 'No markdown variant to inspect', {});
    if (/^---\r?\n[\s\S]+?\r?\n---/.test(res.text)) return makeResult(meta, 'pass', 'Markdown response carries YAML frontmatter', evidence);
    return makeResult(meta, 'warn', 'Markdown has no frontmatter (title/source metadata helps agents cite correctly)', evidence);
  },
};

export const pageTokenBudget: Check = {
  id: 'page-token-budget',
  category: 'content',
  title: 'Page fits an agent token budget',
  spec: { url: 'https://ora.ai/docs', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'page-token-budget', category: 'content' as const, title: 'Page fits an agent token budget', spec: { url: 'https://ora.ai/docs', asOf: '2026-10-22' } };
    const { res, evidence } = await getMarkdown(target, http);
    let chars: number;
    if (res.status === 200 && isMarkdown(res)) {
      chars = res.text.length;
    } else {
      const page = await fetchPage(target.contentUrl.toString(), http);
      chars = parseHtml(page.body).textLength;
    }
    const approxTokens = Math.round(chars / 4);
    if (chars < 500) return makeResult(meta, 'warn', `Only ${chars} chars extracted — too little content to evaluate`, evidence);
    if (approxTokens <= 25000) return makeResult(meta, 'pass', `~${approxTokens.toLocaleString()} tokens — fits comfortably in a context window`, evidence);
    return makeResult(meta, 'warn', `~${approxTokens.toLocaleString()} tokens — exceeds a ~25K token agent budget`, evidence);
  },
};

export const codeFenceValidity: Check = {
  id: 'code-fence-validity',
  category: 'content',
  title: 'Markdown code fences valid',
  spec: { url: 'https://spec.commonmark.org/0.31.2/#fenced-code-blocks', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'code-fence-validity', category: 'content' as const, title: 'Markdown code fences valid', spec: { url: 'https://spec.commonmark.org/0.31.2/#fenced-code-blocks', asOf: '2026-10-22' } };
    const { res, evidence } = await getMarkdown(target, http);
    if (res.status !== 200 || !isMarkdown(res)) return makeResult(meta, 'skip', 'No markdown variant to inspect', {});
    const fences = res.text.match(/^```/gm) ?? [];
    if (fences.length === 0) return makeResult(meta, 'pass', 'No fenced code blocks (nothing to break)', evidence);
    if (fences.length % 2 !== 0) return makeResult(meta, 'warn', `${fences.length} fence markers — odd count means an unclosed code block`, evidence);
    return makeResult(meta, 'pass', `${fences.length / 2} balanced fenced code block(s)`, evidence);
  },
};

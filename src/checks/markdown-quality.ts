import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchPage, fetchText, getEvidence, makeResult, memoize } from './_shared';
import { parseHtml } from './_html';

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

export const markdownFrontmatter: Check = {
  id: 'markdown-frontmatter',
  category: 'content',
  title: 'Markdown frontmatter metadata',
  spec: { url: 'https://frontmatter.codes/', asOf: '2026-10-22' },
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

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
  pageScoped: true,

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
  pageScoped: true,

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

import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';
import { fetchContentPage, htmlLinkHrefs, parseLinkHeader } from './_page';

const META = {
  id: 'markdown-mirror',
  category: 'content' as const,
  title: 'Per-page .md markdown mirror',
  spec: { url: 'https://llmstxt.org/', asOf: '2026-10-13' },
};

function mirrorCandidates(contentUrl: URL): string[] {
  const out = new Set<string>();
  const path = contentUrl.pathname;
  const base = `${contentUrl.origin}`;
  if (path.endsWith('/')) {
    out.add(`${base}${path}index.md`);
    out.add(`${base}${path}index.html.md`);
  } else if (/\.html?$/i.test(path)) {
    out.add(`${base}${path}.md`);
    out.add(`${base}${path.replace(/\.html?$/i, '.md')}`);
  } else {
    out.add(`${base}${path}.md`);
    out.add(`${base}${path}/index.md`);
  }
  return [...out];
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype|^\s*<html/i.test(text.slice(0, 512));
}

const markdownMirror: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const tried: string[] = [];

    // Prefer a declared mirror via Link header or <link rel="alternate"> before guessing paths.
    const discovered: string[] = [];
    try {
      const page = await fetchContentPage(target, http);
      for (const link of parseLinkHeader(page.headers.get('link'))) {
        if (link.params.rel === 'alternate' && link.params.type?.toLowerCase().includes('text/markdown')) {
          discovered.push(new URL(link.url, page.finalUrl).toString());
        }
      }
      for (const href of htmlLinkHrefs(page.bodyText, 'alternate', 'text/markdown')) {
        discovered.push(new URL(href, page.finalUrl).toString());
      }
    } catch { /* discovery is best-effort */ }

    for (const url of [...discovered, ...mirrorCandidates(target.contentUrl)]) {
      tried.push(url);
      const res = await http.fetch(url);
      if (res.status !== 200) continue;
      const bodyText = decodeBody(res.body);
      const evidence: Evidence = {
        request: { method: 'GET', url },
        response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: bodyText.slice(0, 256) },
      };
      if (!/markdown|text\/plain/i.test(res.contentType)) continue;
      if (bodyText.length === 0) return makeResult(META, 'fail', `${url} returns empty markdown`, evidence);
      if (looksLikeHtml(bodyText)) continue;
      return makeResult(META, 'pass', `Markdown mirror at ${new URL(url).pathname}`, evidence);
    }

    const evidence: Evidence = {
      request: { method: 'GET', url: target.contentUrl.toString() + '.md' },
      note: `Tried: ${tried.slice(0, 5).join(', ')}`,
    };
    return makeResult(META, 'fail', 'No .md markdown mirror found for the content page', evidence);
  },
};

export default markdownMirror;

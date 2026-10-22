import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchText, getEvidence, makeResult, memoize } from './_shared';

const SPEC = { url: 'https://llmstxt.org/', asOf: '2026-10-22' };

interface LlmsDoc { body: string; url: string; evidence: Evidence }

function getLlms(target: Target, http: HttpClient): Promise<LlmsDoc | null> {
  return memoize(`llms:${target.origin}`, async () => {
    const url = new URL('/llms.txt', target.origin).toString();
    const res = await fetchText(url, http);
    if (res.status !== 200 || !/text|markdown/i.test(res.contentType) || res.text.trim().length === 0) return null;
    return { body: res.text, url, evidence: getEvidence('GET', url, res) };
  });
}

function mdLinks(body: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  for (const m of body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) out.push({ text: m[1], href: m[2] });
  return out;
}

export const llmsTxtFormatting: Check = {
  id: 'llms-txt-formatting',
  category: 'content',
  title: 'llms.txt formatting',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'llms-txt-formatting', category: 'content' as const, title: 'llms.txt formatting', spec: SPEC };
    const doc = await getLlms(target, http);
    if (!doc) return makeResult(meta, 'skip', 'No llms.txt to grade', {});
    const missing: string[] = [];
    if (!/^#\s+\S/m.test(doc.body)) missing.push('H1 heading');
    if (!/^>\s*\S/m.test(doc.body)) missing.push('blockquote summary');
    if (mdLinks(doc.body).length === 0) missing.push('markdown links');
    if (!/^##\s+\S/m.test(doc.body)) missing.push('section headings');
    if (missing.length >= 3) return makeResult(meta, 'warn', `llms.txt lacks structure: ${missing.join(', ')}`, doc.evidence);
    if (missing.length) return makeResult(meta, 'pass', `Well formed (minor gaps: ${missing.join(', ')})`, doc.evidence);
    return makeResult(meta, 'pass', 'H1, summary, sectioned markdown links — spec-conformant', doc.evidence);
  },
};

export const llmsTxtLinksResolve: Check = {
  id: 'llms-txt-links-resolve',
  category: 'content',
  title: 'llms.txt links resolve',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'llms-txt-links-resolve', category: 'content' as const, title: 'llms.txt links resolve', spec: SPEC };
    const doc = await getLlms(target, http);
    if (!doc) return makeResult(meta, 'skip', 'No llms.txt to check', {});
    const links = mdLinks(doc.body).slice(0, 8);
    if (links.length === 0) return makeResult(meta, 'warn', 'llms.txt contains no links to verify', doc.evidence);
    const broken: string[] = [];
    for (const l of links) {
      const u = new URL(l.href, target.origin).toString();
      try {
        const res = await fetchText(u, http);
        if (res.status >= 400) broken.push(`${l.href} (HTTP ${res.status})`);
      } catch {
        broken.push(`${l.href} (request failed)`);
      }
    }
    doc.evidence.note = `sampled ${links.length} links`;
    if (broken.length) return makeResult(meta, 'warn', `${broken.length}/${links.length} llms.txt links broken: ${broken.slice(0, 3).join(', ')}`, doc.evidence);
    return makeResult(meta, 'pass', `All ${links.length} sampled llms.txt links resolve`, doc.evidence);
  },
};

export const modularLlmsTxt: Check = {
  id: 'modular-llms-txt',
  category: 'content',
  title: 'Modular llms.txt per product area',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'modular-llms-txt', category: 'content' as const, title: 'Modular llms.txt per product area', spec: SPEC };
    const doc = await getLlms(target, http);
    if (!doc) return makeResult(meta, 'skip', 'No llms.txt to inspect', {});
    const links = mdLinks(doc.body);
    const modular = links.filter((l) => /llms[^/]*\.txt|llms\.txt/i.test(l.href));
    if (modular.length) return makeResult(meta, 'pass', `Root llms.txt references ${modular.length} per-area llms.txt file(s)`, doc.evidence);
    for (const path of ['/docs/llms.txt', '/api/llms.txt']) {
      const res = await fetchText(new URL(path, target.origin).toString(), http);
      if (res.status === 200 && /text|markdown/i.test(res.contentType)) {
        return makeResult(meta, 'pass', `Per-area llms.txt found at ${path}`, doc.evidence);
      }
    }
    return makeResult(meta, 'warn', 'Single flat llms.txt — consider per-area files (e.g. /docs/llms.txt) for large sites', doc.evidence);
  },
};

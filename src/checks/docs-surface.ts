import type { Check, CheckResult, HttpClient, Target } from '../types';
import { fetchPage, fetchText, getEvidence, isRecord, makeResult, memoize } from './_shared';
import { parseHtml, type AnchorTag } from './_html';
import { getOpenApi } from './_openapi';

const SPECS: Record<string, { url: string; asOf: string }> = {
  'trust-anchors': { url: 'https://agent-ready.dev/what-is-an-agent-ready-website', asOf: '2026-10-22' },
  'public-api-docs': { url: 'https://spec.openapis.org/oas/latest.html', asOf: '2026-10-22' },
  'developer-portal': { url: 'https://agent-ready.dev/what-is-an-agent-ready-website', asOf: '2026-10-22' },
  'agent-instruction': { url: 'https://llmstxt.org/', asOf: '2026-10-22' },
  'docs-auth-gate': { url: 'https://agent-ready.dev/what-is-an-agent-ready-website', asOf: '2026-10-22' },
};

function homeAnchors(target: Target, http: HttpClient): Promise<AnchorTag[]> {
  return memoize(`anchors:${target.contentUrl}`, async () => {
    const page = await fetchPage(target.contentUrl.toString(), http);
    return page.status === 200 ? parseHtml(page.body).anchors : [];
  });
}

function meta(id: string, title: string) {
  return { id, category: 'content' as const, title, spec: SPECS[id] };
}

export const trustAnchors: Check = {
  ...meta('trust-anchors', 'Trust anchor pages'),
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const m = meta('trust-anchors', 'Trust anchor pages');
    const paths = ['/about', '/about-us', '/contact', '/privacy', '/terms', '/.well-known/security.txt'];
    let found = 0;
    const ok: string[] = [];
    for (const path of paths) {
      const url = new URL(path, target.origin).toString();
      try {
        const res = await fetchText(url, http);
        const len = /html/i.test(res.contentType) ? parseHtml(res.text).textLength : res.text.trim().length;
        if (res.status === 200 && len > 80) { found++; ok.push(path); }
      } catch { /* continue */ }
    }
    const evidence = { note: `reachable: ${ok.join(', ') || 'none'}` };
    if (found >= 2) return makeResult(m, 'pass', `${found} trust anchor pages with real content (${ok.slice(0, 4).join(', ')})`, evidence);
    if (found === 1) return makeResult(m, 'warn', `Only ${ok[0]} found — add about/contact/privacy pages`, evidence);
    return makeResult(m, 'warn', 'No about/contact/privacy/security.txt pages found — agents cannot verify legitimacy', evidence);
  },
};

export const publicApiDocs: Check = {
  ...meta('public-api-docs', 'Public API/docs linked from homepage'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('public-api-docs', 'Public API/docs linked from homepage');
    const anchors = await homeAnchors(target, http);
    const link = anchors.find((a) => /\/(docs?|api|developers?|reference|guides?)(\/|$|\.)/i.test(a.href) || /docs|api reference/i.test(a.text));
    if (link) {
      const u = new URL(link.href, target.contentUrl).toString();
      const res = await fetchText(u, http);
      if (res.status === 200) return makeResult(m, 'pass', `Docs linked from homepage: ${link.href}`, getEvidence('GET', u, res));
      return makeResult(m, 'warn', `Docs link ${link.href} returned HTTP ${res.status}`, getEvidence('GET', u, res));
    }
    const spec = await getOpenApi(target, http);
    if (spec) return makeResult(m, 'pass', `No homepage docs link, but OpenAPI spec found at ${new URL(spec.url).pathname}`, {});
    return makeResult(m, 'warn', 'No documentation or API link found on the homepage', {});
  },
};

export const developerPortal: Check = {
  ...meta('developer-portal', 'Developer portal / self-serve signup'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('developer-portal', 'Developer portal / self-serve signup');
    const anchors = await homeAnchors(target, http);
    const link = anchors.find((a) => /\/(developers?|portal|console|dashboard|signup|sign-up|register|get-started)(\/|$|\.)/i.test(a.href) || /get started|sign up|api keys?|developer/i.test(a.text));
    if (!link) return makeResult(m, 'warn', 'No developer portal or signup link found on the homepage', {});
    const u = new URL(link.href, target.contentUrl).toString();
    try {
      const res = await fetchText(u, http);
      if (res.status === 200) return makeResult(m, 'pass', `Self-serve portal reachable: ${link.href}`, getEvidence('GET', u, res));
      return makeResult(m, 'warn', `Portal link ${link.href} returned HTTP ${res.status}`, getEvidence('GET', u, res));
    } catch {
      return makeResult(m, 'warn', `Portal link ${link.href} unreachable`, {});
    }
  },
};

export const agentInstruction: Check = {
  ...meta('agent-instruction', 'Agent instruction / when-to-use guidance'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('agent-instruction', 'Agent instruction / when-to-use guidance');
    const sources: string[] = [];
    const llms = await fetchText(new URL('/llms.txt', target.origin).toString(), http);
    if (llms.status === 200 && /\[.+\]\(.+\)/.test(llms.text) && llms.text.trim().length > 100) sources.push('llms.txt');
    const agentJson = await fetchText(new URL('/.well-known/agent.json', target.origin).toString(), http);
    if (agentJson.status === 200 && /json/i.test(agentJson.contentType)) {
      try {
        const d = JSON.parse(agentJson.text);
        if (isRecord(d) && (d.description || d.instructions || d.capabilities)) sources.push('agent.json');
      } catch { /* ignore */ }
    }
    const page = await fetchPage(target.contentUrl.toString(), http);
    if (page.status === 200) {
      const doc = parseHtml(page.body);
      const desc = doc.metas.find((x) => x.name === 'description')?.content ?? '';
      if (/\b(api|sdk|integrat|automat|use\s+\w+\s+(to|for))\b/i.test(desc)) sources.push('meta description');
    }
    if (sources.length) return makeResult(m, 'pass', `Usage guidance found in: ${sources.join(', ')}`, {});
    return makeResult(m, 'warn', 'No machine-readable "when to use us" guidance (llms.txt, agent.json, or descriptive meta)', {});
  },
};

export const docsAuthGate: Check = {
  ...meta('docs-auth-gate', 'Content behind auth'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('docs-auth-gate', 'Content behind auth');
    const anchors = await homeAnchors(target, http);
    const seen = new Set<string>();
    const internal = anchors
      .map((a) => { try { return new URL(a.href, target.contentUrl); } catch { return null; } })
      .filter((u): u is URL => u !== null && u.origin === target.origin.origin)
      .filter((u) => { const k = u.pathname; if (seen.has(k)) return false; seen.add(k); return true; })
      .filter((u) => /\.(md|txt)$|\/(docs?|guide|article|blog|reference)/i.test(u.pathname))
      .slice(0, 4);
    if (internal.length === 0) return makeResult(m, 'skip', 'No internal docs-like links to sample', {});
    const gated: string[] = [];
    for (const u of internal) {
      try {
        const res = await fetchText(u.toString(), http);
        const finalPath = new URL(res.finalUrl).pathname;
        if (res.status === 401 || res.status === 403 || /\/(login|signin|sign-in|auth)/i.test(finalPath)) {
          gated.push(`${u.pathname} (→ ${res.status} ${finalPath})`);
        }
      } catch { /* ignore */ }
    }
    const evidence = { note: `sampled: ${internal.map((u) => u.pathname).join(', ')}` };
    if (gated.length) return makeResult(m, 'warn', `Pages behind auth: ${gated.join(', ')}`, evidence);
    return makeResult(m, 'pass', `${internal.length} sampled content pages publicly readable`, evidence);
  },
};

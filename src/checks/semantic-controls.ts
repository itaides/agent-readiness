import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { fetchContentPage } from './_page';

const META = {
  id: 'semantic-controls',
  category: 'content' as const,
  title: 'Semantic agent-navigable controls',
  spec: { url: 'https://axd.md/', asOf: '2026-10-13' },
};

const GENERIC_TEXT = /^\s*(click here|here|learn more|read more|more|link|this)\s*[.!?]?\s*$/i;

const semanticControls: Check = {
  ...META,
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    if (page.status !== 200) return makeResult(META, 'warn', `HTTP ${page.status} — could not inspect controls`, evidence);
    if (page.contentType && !/text\/html/i.test(page.contentType)) {
      return makeResult(META, 'warn', `content-type "${page.contentType}" is not text/html`, evidence);
    }

    const semanticButtons = page.bodyText.match(/<button[\s>]/gi)?.length ?? 0;
    const semanticLinks = page.bodyText.match(/<a[\s>][^>]*\bhref\s*=/gi)?.length ?? 0;
    const fakeControls = page.bodyText.match(/<(?:div|span|img)[^>]*\bonclick\s*=/gi)?.length ?? 0;
    const linkTexts = [...page.bodyText.matchAll(/<a[\s>][^>]*\bhref\s*=[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
      .filter((t) => t.length > 0);
    const genericLinks = linkTexts.filter((t) => GENERIC_TEXT.test(t)).length;
    const unlabelledInputs = [...page.bodyText.matchAll(/<input\b[^>]*>/gi)]
      .filter((m) => !/\btype\s*=\s*["']?(hidden|submit|button)/i.test(m[0]))
      .filter((m) => !/\b(aria-label|placeholder|id|name)\s*=/i.test(m[0])).length;

    const problems: string[] = [];
    if (fakeControls > 0) problems.push(`${fakeControls} non-semantic click handler(s) on div/span`);
    if (linkTexts.length >= 4 && genericLinks / linkTexts.length > 0.5) {
      problems.push(`${genericLinks}/${linkTexts.length} links use generic text ("click here" style)`);
    }
    if (unlabelledInputs > 0) problems.push(`${unlabelledInputs} unlabelled input(s)`);

    if (problems.length) return makeResult(META, 'warn', problems.join('; '), evidence);
    if (semanticButtons + semanticLinks === 0) {
      return makeResult(META, 'warn', 'No semantic links or buttons found — page may be JS-rendered only', evidence);
    }
    return makeResult(META, 'pass', `${semanticLinks} links, ${semanticButtons} buttons — all semantic`, evidence);
  },
};

export default semanticControls;

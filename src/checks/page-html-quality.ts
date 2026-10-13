import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { fetchContentPage, textToHtmlRatio } from './_page';

const META = {
  id: 'page-html-quality',
  category: 'content' as const,
  title: 'Page-level HTML readability',
  spec: { url: 'https://vercel.com/kb/guide/agent-readability-spec', asOf: '2026-10-13' },
};

const MIN_TEXT_RATIO = 0.15;

const pageHtmlQuality: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const page = await fetchContentPage(target, http);
    const evidence = page.evidence;
    const url = page.url;

    if (page.status !== 200) return makeResult(META, 'fail', `HTTP ${page.status}`, evidence);
    if (page.contentType && !/text\/html/i.test(page.contentType)) {
      return makeResult(META, 'fail', `content-type "${page.contentType}" is not text/html`, evidence);
    }
    if (page.redirectChain.length > 1) {
      return makeResult(META, 'fail', `${page.redirectChain.length} redirect hops — agents should reach content in ≤1`, evidence);
    }

    const ratio = textToHtmlRatio(page.bodyText);
    if (ratio <= MIN_TEXT_RATIO) {
      return makeResult(
        META, 'fail',
        `Text-to-HTML ratio ${(ratio * 100).toFixed(1)}% (min ${MIN_TEXT_RATIO * 100}%) — likely an SPA shell or markup-heavy page agents can't read`,
        evidence,
      );
    }

    const missing: string[] = [];
    if (!/<html[^>]*\blang\s*=/i.test(page.bodyText)) missing.push('<html lang>');
    const desc = page.bodyText.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i)
      ?? page.bodyText.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i);
    if (!desc || desc[1].trim().length < 50) missing.push('meta description ≥50 chars');
    if (!/<meta[^>]*property\s*=\s*["']og:title["']/i.test(page.bodyText)) missing.push('og:title');
    if (!/<meta[^>]*property\s*=\s*["']og:description["']/i.test(page.bodyText)) missing.push('og:description');
    if (!/<link[^>]*rel\s*=\s*["'][^"']*canonical["']/i.test(page.bodyText)) missing.push('canonical link');
    const headings = page.bodyText.match(/<h[1-3][\s>]/gi)?.length ?? 0;
    if (headings < 3) missing.push(`≥3 h1–h3 headings (found ${headings})`);

    if (missing.length) {
      return makeResult(META, 'warn', `Readable HTML but missing: ${missing.join(', ')}`, evidence);
    }
    return makeResult(META, 'pass', `Readable HTML: ${(ratio * 100).toFixed(0)}% text ratio, ${headings} headings, full head metadata`, evidence);
  },
};

export default pageHtmlQuality;

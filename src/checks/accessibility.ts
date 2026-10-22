import type { Check, CheckResult } from '../types';
import { fetchPage, makeResult, memoize } from './_shared';
import { injectionHits, parseHtml } from './_html';
import type { HttpClient, Target } from '../types';

const SPEC = { url: 'https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring', asOf: '2026-10-22' };

function getDoc(target: Target, http: HttpClient) {
  return memoize(`ax:${target.contentUrl}`, async () => {
    const page = await fetchPage(target.contentUrl.toString(), http);
    return { doc: parseHtml(page.body), status: page.status, evidence: page.evidence };
  });
}

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

export const axDocumentStructure: Check = {
  ...meta('ax-document-structure', 'Accessible document structure'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('ax-document-structure', 'Accessible document structure');
    const { doc, status, evidence } = await getDoc(target, http);
    if (status !== 200) return makeResult(m, 'skip', `Page returned HTTP ${status}`, {});
    const problems: string[] = [];
    if (!doc.hasMain) problems.push('no <main>/role=main');
    if (!doc.hasNav) problems.push('no <nav>/role=navigation');
    if (!doc.headings.some((h) => h.level === 1)) problems.push('no H1');
    let last = 0;
    let skipped = false;
    for (const h of doc.headings) {
      if (last && h.level > last + 1) skipped = true;
      last = h.level;
    }
    if (skipped) problems.push('heading levels skip');
    if (problems.length === 0) return makeResult(m, 'pass', 'Landmarks and a sane heading outline present', evidence);
    return makeResult(m, 'warn', `Structure gaps: ${problems.join('; ')}`, evidence);
  },
};

export const axNativeControls: Check = {
  ...meta('ax-native-controls', 'Native interactive controls'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('ax-native-controls', 'Native interactive controls');
    const { doc, evidence } = await getDoc(target, http);
    const fake = doc.clickables.filter((c) => c.roleButton);
    if (fake.length) return makeResult(m, 'warn', `${fake.length} clickable div/span/li element(s) — invisible to role-based targeting`, evidence);
    if (doc.textLength < 200) return makeResult(m, 'warn', 'Too little content on the page to evaluate controls', evidence);
    return makeResult(m, 'pass', 'No clickable div/span controls — agents can target real controls', evidence);
  },
};

export const axAccessibleNames: Check = {
  ...meta('ax-accessible-names', 'Accessible names on controls'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('ax-accessible-names', 'Accessible names on controls');
    const { doc, evidence } = await getDoc(target, http);
    if (doc.clickables.length === 0) return makeResult(m, 'skip', 'No interactive controls found', {});
    const unnamed = doc.clickables.filter((c) => !c.named);
    if (unnamed.length === 0 && doc.imagesMissingAlt === 0) {
      return makeResult(m, 'pass', `${doc.clickables.length} controls all have computable names`, evidence);
    }
    const bits: string[] = [];
    if (unnamed.length) bits.push(`${unnamed.length} unnamed control(s)`);
    if (doc.imagesMissingAlt) bits.push(`${doc.imagesMissingAlt} image(s) without alt`);
    return makeResult(m, 'warn', `Unnamed elements: ${bits.join('; ')}`, evidence);
  },
};

export const axFormLabeling: Check = {
  ...meta('ax-form-labeling', 'Form control labeling'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('ax-form-labeling', 'Form control labeling');
    const { doc, evidence } = await getDoc(target, http);
    const inputs = doc.forms.flatMap((f) => f.inputs);
    if (inputs.length === 0) return makeResult(m, 'skip', 'No forms on the page', {});
    const unlabeled = inputs.filter((i) => !i.labeled);
    if (unlabeled.length === 0) return makeResult(m, 'pass', `All ${inputs.length} form controls labeled`, evidence);
    return makeResult(m, 'warn', `${unlabeled.length}/${inputs.length} form controls lack labels or aria names`, evidence);
  },
};

export const axTreeInjectionSafe: Check = {
  ...meta('ax-tree-injection-safe', 'Accessibility-tree injection safety'),
  defaultEnabled: true,
  scored: false,
  pageScoped: true,

  async run(target, http): Promise<CheckResult> {
    const m = meta('ax-tree-injection-safe', 'Accessibility-tree injection safety');
    const { doc, evidence } = await getDoc(target, http);
    const hits = injectionHits([...doc.ariaTexts, ...doc.hiddenText]);
    if (hits.length) return makeResult(m, 'warn', `Suspicious agent-directed text found: "${hits[0].slice(0, 120)}"`, evidence);
    if (doc.textLength < 200) return makeResult(m, 'warn', 'Too little content on the page to evaluate hidden text', evidence);
    return makeResult(m, 'pass', 'No hidden agent-directed instructions in aria/alt/off-screen text', evidence);
  },
};

import type { Check, CheckResult } from '../types';
import { fetchPage, fetchText, isRecord, makeResult, memoize } from './_shared';
import { parseHtml } from './_html';
import { getOpenApi } from './_openapi';
import type { HttpClient, Target } from '../types';

const SPEC = { url: 'https://ora.ai/docs', asOf: '2026-10-22' };

function getAnchors(target: Target, http: HttpClient) {
  return memoize(`dx-anchors:${target.contentUrl}`, async () => {
    const page = await fetchPage(target.contentUrl.toString(), http);
    return { anchors: page.status === 200 ? parseHtml(page.body).anchors : [], evidence: page.evidence };
  });
}

export const onboardingFriction: Check = {
  id: 'onboarding-friction',
  category: 'capabilities',
  title: 'Agent onboarding friction',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'onboarding-friction', category: 'capabilities' as const, title: 'Agent onboarding friction', spec: SPEC };
    const signals: string[] = [];
    const spec = await getOpenApi(target, http);
    if (spec) signals.push('machine-readable API spec');
    const { anchors } = await getAnchors(target, http);
    if (anchors.some((a) => /sign[-_ ]?up|register|get[-_ ]?started|api[-_ ]?key|console|dashboard/i.test(`${a.href} ${a.text}`))) signals.push('self-serve signup link');
    const authMd = await fetchText(new URL('/auth.md', target.origin).toString(), http);
    if (authMd.status === 200) signals.push('auth.md walkthrough');
    const ucp = await fetchText(new URL('/.well-known/ucp', target.origin).toString(), http);
    void ucp;
    if (signals.length >= 2) return makeResult(meta, 'pass', `Self-serve signals: ${signals.join(', ')}`, {});
    if (signals.length === 1) return makeResult(meta, 'warn', `Only "${signals[0]}" found — agent may not reach a first API call alone`, {});
    return makeResult(meta, 'warn', 'No self-serve onboarding path found (spec, signup, or auth.md)', {});
  },
};

export const sandboxEnvironment: Check = {
  id: 'sandbox-environment',
  category: 'capabilities',
  title: 'Sandbox / test environment',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'sandbox-environment', category: 'capabilities' as const, title: 'Sandbox / test environment', spec: SPEC };
    const signals: string[] = [];
    const spec = await getOpenApi(target, http);
    if (spec) {
      const servers = spec.doc?.servers;
      if (Array.isArray(servers) && servers.some((s) => isRecord(s) && /sandbox|test|staging|dev/i.test(String(s.url)))) {
        signals.push('OpenAPI sandbox server');
      }
      if (/test_?key|sandbox|test mode|pk_test/i.test(specTextAll(spec))) signals.push('sandbox/test-mode mention in spec');
    }
    const { anchors } = await getAnchors(target, http);
    if (anchors.some((a) => /sandbox|playground|test[-_ ]?env|try[-_ ]?it/i.test(`${a.href} ${a.text}`))) signals.push('sandbox link on page');
    if (signals.length) return makeResult(meta, 'pass', `Sandbox signals: ${signals.join(', ')}`, {});
    return makeResult(meta, 'warn', 'No sandbox or test environment detected', {});
  },
};

function specTextAll(spec: { raw: string }): string {
  return spec.raw;
}

import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';
import { detectLocal } from '../target';

const META = {
  id: 'mpp',
  category: 'commerce' as const,
  title: 'Machine Payments Protocol challenge',
  spec: { url: 'https://mpp.dev/', asOf: '2026-08-04' },
};

const mpp: Check = {
  ...META,
  defaultEnabled: false,
  scored: true,

  async run(target, http, options): Promise<CheckResult> {
    if (!options?.commerceUrl) return makeResult(META, 'skip', 'Provide --commerce-url to enable commerce checks', {});
    if (target.isLocal || detectLocal(options.commerceUrl.hostname)) return makeResult(META, 'skip', 'Commerce checks are disabled for local/private targets', {});
    const url = options.commerceUrl.toString();
    const response = await http.fetch(url);
    const challenge = response.headers.get('www-authenticate') ?? '';
    const paymentChallenges = challenge.split(/,(?=\s*[A-Za-z][A-Za-z0-9_-]*\s)/).filter((part) => /^\s*Payment(?:\s|$)/i.test(part));
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: response.status, contentType: response.contentType, bytes: response.body.length, finalUrl: response.finalUrl },
      note: challenge ? `WWW-Authenticate: ${challenge.slice(0, 500)}` : 'WWW-Authenticate header absent',
    };
    if (response.status !== 402) return makeResult(META, 'fail', `Expected HTTP 402, got ${response.status}`, evidence);
    if (paymentChallenges.length === 0) return makeResult(META, 'fail', 'HTTP 402 response has no WWW-Authenticate: Payment challenge', evidence);
    return makeResult(META, 'pass', `${paymentChallenges.length} MPP Payment challenge(s) advertised`, evidence);
  },
};

export default mpp;

import type { Check, CheckResult, Evidence } from '../types';
import { makeResult } from './_shared';
import { detectLocal } from '../target';

const META = {
  id: 'x402',
  category: 'commerce' as const,
  title: 'x402 payment challenge',
  spec: { url: 'https://docs.x402.org/core-concepts/http-402', asOf: '2026-08-04' },
};

function decodePaymentRequired(value: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

const x402: Check = {
  ...META,
  defaultEnabled: false,
  scored: true,

  async run(target, http, options): Promise<CheckResult> {
    if (!options?.commerceUrl) return makeResult(META, 'skip', 'Provide --commerce-url to enable commerce checks', {});
    if (target.isLocal || detectLocal(options.commerceUrl.hostname)) return makeResult(META, 'skip', 'Commerce checks are disabled for local/private targets', {});
    const url = options.commerceUrl.toString();
    const response = await http.fetch(url);
    const header = response.headers.get('payment-required');
    const evidence: Evidence = {
      request: { method: 'GET', url },
      response: { status: response.status, contentType: response.contentType, bytes: response.body.length, finalUrl: response.finalUrl },
      note: header ? 'PAYMENT-REQUIRED header present' : 'PAYMENT-REQUIRED header absent',
    };
    if (response.status !== 402) return makeResult(META, 'fail', `Expected HTTP 402, got ${response.status}`, evidence);
    if (!header) return makeResult(META, 'fail', 'HTTP 402 response is missing PAYMENT-REQUIRED', evidence);
    const payment = decodePaymentRequired(header);
    if (!payment) return makeResult(META, 'fail', 'PAYMENT-REQUIRED is not valid Base64-encoded JSON', evidence);
    if (payment.x402Version !== 2) return makeResult(META, 'fail', 'PaymentRequired must declare x402Version: 2', evidence);
    if (!Array.isArray(payment.accepts) || payment.accepts.length === 0) return makeResult(META, 'fail', 'PaymentRequired.accepts must be a non-empty array', evidence);
    return makeResult(META, 'pass', `Valid x402 v2 challenge with ${payment.accepts.length} payment option(s)`, evidence);
  },
};

export default x402;

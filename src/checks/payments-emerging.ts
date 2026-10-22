import type { Check, CheckResult, CheckRunOptions, HttpClient, Target } from '../types';
import { fetchJsonWellKnown, fetchText, isRecord, makeResult } from './_shared';
import { detectLocal } from '../target';

// Emerging payment protocols. Activated with --commerce-url (like ucp/x402/mpp).
// Detection is conservative: we look for live endpoints or declared handlers
// and never send payment credentials.

const SPECS = {
  acp: { url: 'https://agenticcommerceprotocol.com/', asOf: '2026-10-22' },
  ap2: { url: 'https://github.com/google-agentic-commerce/AP2', asOf: '2026-10-22' },
} as const;

function meta(id: string, title: string, spec: { url: string; asOf: string }) {
  return { id, category: 'commerce' as const, title, spec };
}

function commerceOrigin(target: Target, options: CheckRunOptions | undefined): string | null {
  if (!options?.commerceUrl) return null;
  if (target.isLocal || detectLocal(options.commerceUrl.hostname)) return null;
  return options.commerceUrl.origin;
}

async function endpointExists(url: string, http: HttpClient): Promise<{ exists: boolean; status: number }> {
  const res = await fetchText(url, http, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  // A real checkout/delegate endpoint rejects the empty call with 4xx —
  // a missing route answers 404/405.
  return { exists: res.status !== 404 && res.status !== 405 && res.status < 500, status: res.status };
}

export const acpSupport: Check = {
  ...meta('acp-support', 'ACP checkout_sessions endpoint', SPECS.acp),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('acp-support', 'ACP checkout_sessions endpoint', SPECS.acp);
    const origin = commerceOrigin(target, options);
    if (!origin) return makeResult(m, 'skip', 'Provide --commerce-url (public target) to enable commerce checks', {});
    const url = new URL('/checkout_sessions', origin).toString();
    try {
      const probe = await endpointExists(url, http);
      const evidence = { request: { method: 'POST', url }, response: { status: probe.status } };
      if (probe.exists) return makeResult(m, 'pass', `ACP checkout endpoint responds (HTTP ${probe.status})`, evidence);
      return makeResult(m, 'warn', `No ACP /checkout_sessions endpoint (HTTP ${probe.status})`, evidence);
    } catch {
      return makeResult(m, 'warn', 'ACP checkout endpoint unreachable', {});
    }
  },
};

export const acpDelegatePayment: Check = {
  ...meta('acp-delegate-payment', 'ACP delegate payment endpoint', SPECS.acp),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('acp-delegate-payment', 'ACP delegate payment endpoint', SPECS.acp);
    const origin = commerceOrigin(target, options);
    if (!origin) return makeResult(m, 'skip', 'Provide --commerce-url (public target) to enable commerce checks', {});
    const url = new URL('/agentic_commerce/delegate_payment', origin).toString();
    try {
      const probe = await endpointExists(url, http);
      const evidence = { request: { method: 'POST', url }, response: { status: probe.status } };
      if (probe.exists) return makeResult(m, 'pass', `Delegate payment endpoint responds (HTTP ${probe.status})`, evidence);
      return makeResult(m, 'warn', `No /agentic_commerce/delegate_payment endpoint (HTTP ${probe.status})`, evidence);
    } catch {
      return makeResult(m, 'warn', 'Delegate payment endpoint unreachable', {});
    }
  },
};

export const ap2Support: Check = {
  ...meta('ap2-support', 'AP2 agent payments', SPECS.ap2),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('ap2-support', 'AP2 agent payments', SPECS.ap2);
    const origin = commerceOrigin(target, options);
    if (!origin) return makeResult(m, 'skip', 'Provide --commerce-url (public target) to enable commerce checks', {});
    const signals: string[] = [];
    const ucp = await fetchJsonWellKnown(new URL(origin), '/.well-known/ucp', http);
    if (ucp.ok && isRecord(ucp.data)) {
      const handlers = JSON.stringify(ucp.data).toLowerCase();
      if (/ap2|mandate/.test(handlers)) signals.push('UCP payment_handlers reference AP2/mandates');
    }
    const wk = await fetchText(new URL('/.well-known/ap2', origin).toString(), http);
    if (wk.status === 200 && /json/i.test(wk.contentType)) signals.push('/.well-known/ap2 document');
    if (signals.length) return makeResult(m, 'pass', signals.join('; '), {});
    return makeResult(m, 'warn', 'No AP2 mandate discovery surface found', {});
  },
};

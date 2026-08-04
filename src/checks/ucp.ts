import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';
import { detectLocal } from '../target';

const META = {
  id: 'ucp',
  category: 'commerce' as const,
  title: 'Universal Commerce Protocol discovery',
  spec: { url: 'https://ucp.dev/specification/overview/', asOf: '2026-08-04' },
};

const ucp: Check = {
  ...META,
  defaultEnabled: false,
  scored: true,

  async run(target, http, options): Promise<CheckResult> {
    if (!options?.commerceUrl) return makeResult(META, 'skip', 'Provide --commerce-url to enable commerce checks', {});
    if (target.isLocal || detectLocal(options.commerceUrl.hostname)) return makeResult(META, 'skip', 'Commerce checks are disabled for local/private targets', {});
    const result = await fetchJsonWellKnown(new URL(options.commerceUrl.origin), '/.well-known/ucp', http);
    if (!result.ok) return makeResult(META, 'fail', result.reason, result.evidence);
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return makeResult(META, 'fail', 'UCP profile must be a JSON object', result.evidence);
    const ucpProfile = (result.data as Record<string, unknown>).ucp;
    if (!ucpProfile || typeof ucpProfile !== 'object' || Array.isArray(ucpProfile)) return makeResult(META, 'fail', 'Profile missing required "ucp" object', result.evidence);
    const profile = ucpProfile as Record<string, unknown>;
    if (typeof profile.version !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(profile.version)) return makeResult(META, 'fail', 'ucp.version must use YYYY-MM-DD', result.evidence);
    if (!profile.services || typeof profile.services !== 'object' || Array.isArray(profile.services)) return makeResult(META, 'fail', 'ucp.services must be an object', result.evidence);
    if (!profile.payment_handlers || typeof profile.payment_handlers !== 'object' || Array.isArray(profile.payment_handlers)) return makeResult(META, 'fail', 'ucp.payment_handlers must be an object', result.evidence);
    return makeResult(META, 'pass', `UCP ${profile.version} profile discovered`, result.evidence);
  },
};

export default ucp;

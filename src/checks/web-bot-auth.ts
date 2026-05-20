import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'web-bot-auth',
  category: 'bot-access' as const,
  title: 'Web Bot Auth public key directory',
  spec: { url: 'https://datatracker.ietf.org/doc/draft-ietf-httpbis-message-signatures/', asOf: '2026-04-17' },
};

const webBotAuth: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const r = await fetchJsonWellKnown(target.origin, '/.well-known/http-message-signatures-directory', http);
    if (!r.ok) return makeResult(META, 'fail', r.reason, r.evidence);

    const data = r.data as Record<string, unknown>;
    const keys: unknown[] | null = Array.isArray(data)
      ? data
      : Array.isArray((data as { keys?: unknown[] }).keys)
        ? (data as { keys: unknown[] }).keys
        : null;
    if (!keys) return makeResult(META, 'fail', 'JSON parses but no keys array (expected top-level array or { keys: [...] })', r.evidence);
    if (keys.length === 0) return makeResult(META, 'fail', 'Keys array is empty', r.evidence);

    const hasJwkLike = keys.some((k) => k && typeof k === 'object' && ('kid' in (k as object) || 'kty' in (k as object)));
    if (!hasJwkLike) return makeResult(META, 'fail', 'No key entry has "kid" or "kty" — does not look like JWK keys', r.evidence);

    return makeResult(META, 'pass', `${keys.length} key entr${keys.length === 1 ? 'y' : 'ies'}`, r.evidence);
  },
};

export default webBotAuth;

import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, makeResult } from './_shared';

const META = {
  id: 'a2a-agent-card',
  category: 'capabilities' as const,
  title: 'A2A Agent Card',
  spec: { url: 'https://a2a-protocol.org/dev/specification/', asOf: '2026-08-04' },
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const a2aAgentCard: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const result = await fetchJsonWellKnown(target.origin, '/.well-known/agent-card.json', http);
    if (!result.ok) return makeResult(META, 'fail', result.reason, result.evidence);
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      return makeResult(META, 'fail', 'Agent Card must be a JSON object', result.evidence);
    }

    const card = result.data as Record<string, unknown>;
    for (const field of ['name', 'description', 'version'] as const) {
      if (!nonEmptyString(card[field])) return makeResult(META, 'fail', `Agent Card missing required non-empty "${field}"`, result.evidence);
    }
    if (!card.capabilities || typeof card.capabilities !== 'object' || Array.isArray(card.capabilities)) {
      return makeResult(META, 'fail', 'Agent Card missing required "capabilities" object', result.evidence);
    }
    for (const field of ['supportedInterfaces', 'defaultInputModes', 'defaultOutputModes', 'skills'] as const) {
      if (!Array.isArray(card[field]) || card[field].length === 0) {
        return makeResult(META, 'fail', `Agent Card "${field}" must be a non-empty array`, result.evidence);
      }
    }
    for (const field of ['defaultInputModes', 'defaultOutputModes'] as const) {
      if ((card[field] as unknown[]).some((mode) => !nonEmptyString(mode))) {
        return makeResult(META, 'fail', `Agent Card "${field}" entries must be non-empty media type strings`, result.evidence);
      }
    }

    const interfaces = card.supportedInterfaces as Array<Record<string, unknown>>;
    if (interfaces.some((entry) => !entry || !nonEmptyString(entry.url) || !nonEmptyString(entry.protocolBinding) || !nonEmptyString(entry.protocolVersion))) {
      return makeResult(META, 'fail', 'Every supported interface needs url, protocolBinding, and protocolVersion', result.evidence);
    }
    const skills = card.skills as Array<Record<string, unknown>>;
    if (skills.some((skill) => !skill || !nonEmptyString(skill.id) || !nonEmptyString(skill.name) || !nonEmptyString(skill.description) || !Array.isArray(skill.tags))) {
      return makeResult(META, 'fail', 'Every skill needs id, name, description, and tags', result.evidence);
    }

    return makeResult(META, 'pass', `${card.name} v${card.version} exposes ${skills.length} skill(s)`, result.evidence);
  },
};

export default a2aAgentCard;

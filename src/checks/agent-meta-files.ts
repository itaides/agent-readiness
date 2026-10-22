import type { Check, CheckResult } from '../types';
import { fetchJsonWellKnown, fetchText, getEvidence, isRecord, makeResult } from './_shared';

const AGENT_JSON_SPEC = { url: 'https://agent.json', asOf: '2026-10-22' };
const AI_PLUGIN_SPEC = { url: 'https://platform.openai.com/docs/plugins', asOf: '2026-10-22' };
const AGENTS_MD_SPEC = { url: 'https://agents.md/', asOf: '2026-10-22' };

const DISCOVERY_PATHS = ['/.well-known/agent.json', '/agent.json', '/.well-known/agents.json'];

export const agentDiscoveryFile: Check = {
  id: 'agent-discovery-file',
  category: 'discoverability',
  title: 'Agent discovery file (agent.json)',
  spec: AGENT_JSON_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-discovery-file', category: 'discoverability' as const, title: 'Agent discovery file (agent.json)', spec: AGENT_JSON_SPEC };
    let lastReason = '';
    for (const path of DISCOVERY_PATHS) {
      const res = await fetchJsonWellKnown(target.origin, path, http);
      if (res.ok) {
        const d = res.data;
        const descriptive = isRecord(d) && (typeof d.name === 'string' || typeof d.description === 'string' || isRecord(d.services) || Array.isArray(d.endpoints));
        if (!descriptive) return makeResult(meta, 'warn', `${path} returns JSON but no name/description/services fields`, res.evidence);
        return makeResult(meta, 'pass', `Agent discovery file at ${path} describes the site for arriving agents`, res.evidence);
      }
      lastReason = res.reason;
    }
    return makeResult(meta, 'warn', `No agent discovery file at ${DISCOVERY_PATHS.join(', ')} (${lastReason})`, {});
  },
};

export const agentPluginsRepo: Check = {
  id: 'agent-plugins-repo',
  category: 'discoverability',
  title: 'Agent plugin manifest (ai-plugin.json)',
  spec: AI_PLUGIN_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-plugins-repo', category: 'discoverability' as const, title: 'Agent plugin manifest (ai-plugin.json)', spec: AI_PLUGIN_SPEC };
    for (const path of ['/.well-known/ai-plugin.json', '/.well-known/plugin.json']) {
      const res = await fetchJsonWellKnown(target.origin, path, http);
      if (!res.ok) continue;
      const d = res.data;
      if (isRecord(d) && (d.name_for_model || d.name_for_human || d.schema_version || d.name)) {
        return makeResult(meta, 'pass', `Plugin manifest at ${path}`, res.evidence);
      }
      return makeResult(meta, 'warn', `${path} is JSON but lacks plugin manifest fields`, res.evidence);
    }
    return makeResult(meta, 'warn', 'No ai-plugin.json / plugin.json manifest found', {});
  },
};

export const agentRulesRepo: Check = {
  id: 'agent-rules-repo',
  category: 'discoverability',
  title: 'Agent rules / config files',
  spec: AGENTS_MD_SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'agent-rules-repo', category: 'discoverability' as const, title: 'Agent rules / config files', spec: AGENTS_MD_SPEC };
    for (const path of ['/AGENTS.md', '/CLAUDE.md', '/.cursor/rules', '/agents.md']) {
      const url = new URL(path, target.origin).toString();
      const res = await fetchText(url, http);
      const isText = /text\/(plain|markdown|x-markdown)/i.test(res.contentType) && !/^\s*<(!doctype|html)/i.test(res.text);
      if (res.status === 200 && isText && res.text.trim().length > 20) {
        return makeResult(meta, 'pass', `Agent-facing rules published at ${path}`, getEvidence('GET', url, res));
      }
    }
    return makeResult(meta, 'warn', 'No AGENTS.md / CLAUDE.md found — coding agents get no repo-style guidance', {});
  },
};

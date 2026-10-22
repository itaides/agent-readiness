import type { Check, CheckResult } from '../types';
import { fetchText, isRecord, makeResult } from './_shared';
import { getMcpSession } from './_mcp';
import type { HttpClient, Target } from '../types';

// MCP Apps extension (io.modelcontextprotocol/ui): tools reference
// _meta.ui.resourceUri pointing at ui:// resources served by the server.

const SPEC = { url: 'https://modelcontextprotocol.io/extensions/apps/overview', asOf: '2026-10-22' };

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

interface UiSurface {
  tools: Record<string, unknown>[];
  resources: Record<string, unknown>[];
}

async function getUiSurface(url: URL | undefined, http: HttpClient): Promise<{ surface: UiSurface; sessionUrl: string } | null> {
  if (!url) return null;
  const s = await getMcpSession(url, http);
  const tools = await s.getTools();
  const resources = await s.getResources();
  const uiTools = tools.filter((t) => isRecord(t._meta) && (isRecord(t._meta.ui) || (t._meta as Record<string, unknown>)['ui/resourceUri']));
  const uiResources = resources.filter((r) => typeof r.uri === 'string' && ((r.uri as string).startsWith('ui://') || isRecord(r._meta) && (r._meta as Record<string, unknown>).ui));
  return { surface: { tools: uiTools, resources: uiResources }, sessionUrl: s.url };
}

export const mcpAppRegistry: Check = {
  ...meta('mcp-app-registry', 'MCP Apps support'),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('mcp-app-registry', 'MCP Apps support');
    if (!options?.mcpUrl) return makeResult(m, 'skip', 'Provide --mcp-url to run MCP Apps checks', {});
    const ui = await getUiSurface(options.mcpUrl, http);
    const count = (ui?.surface.tools.length ?? 0) + (ui?.surface.resources.length ?? 0);
    if (count === 0) return makeResult(m, 'skip', 'Server exposes no MCP App UI surfaces (not applicable for pure API/data servers)', {});
    return makeResult(m, 'pass', `${count} MCP App surface(s): ${ui!.surface.tools.length} UI tools, ${ui!.surface.resources.length} ui:// resources`, {});
  },
};

export const mcpAppsUiQuality: Check = {
  ...meta('mcp-apps-ui-quality', 'MCP Apps UI quality'),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('mcp-apps-ui-quality', 'MCP Apps UI quality');
    if (!options?.mcpUrl) return makeResult(m, 'skip', 'Provide --mcp-url to run MCP Apps checks', {});
    const ui = await getUiSurface(options.mcpUrl, http);
    if (!ui || ui.surface.resources.length === 0) return makeResult(m, 'skip', 'No ui:// resources to grade', {});
    const problems: string[] = [];
    for (const r of ui.surface.resources.slice(0, 5)) {
      if (typeof r.mimeType === 'string' && !/html/i.test(r.mimeType)) problems.push(`${r.uri}: non-HTML mimeType ${r.mimeType}`);
      if (typeof r.name !== 'string') problems.push(`${r.uri}: no name`);
    }
    if (problems.length) return makeResult(m, 'warn', problems.slice(0, 3).join('; '), {});
    return makeResult(m, 'pass', `${ui.surface.resources.length} UI resource(s) declare HTML mimeType`, {});
  },
};

export const mcpViewDomain: Check = {
  ...meta('mcp-view-domain', 'MCP App view reachable'),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('mcp-view-domain', 'MCP App view reachable');
    if (!options?.mcpUrl) return makeResult(m, 'skip', 'Provide --mcp-url', {});
    const ui = await getUiSurface(options.mcpUrl, http);
    if (!ui || ui.surface.tools.length === 0) return makeResult(m, 'skip', 'No MCP App views to check', {});
    const first = ui.surface.tools[0]._meta as Record<string, unknown>;
    const viewUrl = isRecord(first.ui) ? (first.ui.resourceUri ?? first.ui.resource_uri) : first['ui/resourceUri'];
    if (typeof viewUrl === 'string' && /^https?:/.test(viewUrl)) {
      const res = await fetchText(viewUrl, http);
      if (res.status === 200 && /html/i.test(res.contentType)) return makeResult(m, 'pass', `View loads publicly: ${viewUrl}`, {});
      return makeResult(m, 'warn', `View ${viewUrl} returned HTTP ${res.status}`, {});
    }
    return makeResult(m, 'skip', 'View is served as a ui:// resource (server-side, no public URL)', {});
  },
};

export const mcpViewCsp: Check = {
  ...meta('mcp-view-csp', 'MCP App view CSP'),
  defaultEnabled: false,
  scored: false,

  async run(target, http, options): Promise<CheckResult> {
    const m = meta('mcp-view-csp', 'MCP App view CSP');
    if (!options?.mcpUrl) return makeResult(m, 'skip', 'Provide --mcp-url', {});
    const ui = await getUiSurface(options.mcpUrl, http);
    if (!ui || ui.surface.tools.length === 0) return makeResult(m, 'skip', 'No MCP App views to check', {});
    const cspProblems: string[] = [];
    for (const t of ui.surface.tools) {
      const csp = isRecord(t._meta) && isRecord((t._meta as Record<string, unknown>).ui)
        ? ((t._meta as Record<string, unknown>).ui as Record<string, unknown>).csp : undefined;
      if (isRecord(csp)) {
        const raw = JSON.stringify(csp);
        if (/"?\*"?/.test(raw)) cspProblems.push(`${String(t.name)}: wildcard origin in CSP`);
      }
    }
    if (cspProblems.length) return makeResult(m, 'warn', cspProblems.slice(0, 3).join('; '), {});
    return makeResult(m, 'pass', 'No wildcard CSP origins — hosts can apply their default sandbox', {});
  },
};

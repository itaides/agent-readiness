import type { Check, CheckResult, Evidence } from '../types';
import { decodeBody, makeResult } from './_shared';

const META = {
  id: 'webmcp',
  category: 'capabilities' as const,
  title: 'WebMCP',
  spec: { url: 'https://blog.cloudflare.com/agent-readiness/', asOf: '2026-04-17' },
};

const HEURISTIC_NOTE =
  'WebMCP is a runtime browser API — full detection requires executing JS and observing navigator.modelContext.registerTool(). This check is fetch-only: it looks for a /.well-known/webmcp manifest first, then scans the root HTML for the API name. A site loading WebMCP via a separate JS bundle will not be detected here.';

const webmcp: Check = {
  ...META,
  defaultEnabled: true,
  scored: true,

  async run(target, http): Promise<CheckResult> {
    const wkUrl = new URL('/.well-known/webmcp', target.origin).toString();
    try {
      const wkRes = await http.fetch(wkUrl);
      if (wkRes.status === 200 && /json/i.test(wkRes.contentType)) {
        try {
          const parsed = JSON.parse(decodeBody(wkRes.body));
          if (parsed && typeof parsed === 'object') {
            const evidence: Evidence = {
              request: { method: 'GET', url: wkUrl },
              response: { status: wkRes.status, contentType: wkRes.contentType, bytes: wkRes.body.length },
              note: 'WebMCP manifest at /.well-known/webmcp',
            };
            return makeResult(META, 'pass', 'WebMCP manifest found at /.well-known/webmcp', evidence);
          }
        } catch { /* not parseable, fall through to heuristic */ }
      }
    } catch { /* well-known endpoint unreachable, fall through */ }

    const rootUrl = target.origin.toString();
    const res = await http.fetch(rootUrl);
    const bodyText = decodeBody(res.body);
    const evidence: Evidence = {
      request: { method: 'GET', url: rootUrl },
      response: { status: res.status, contentType: res.contentType, bytes: res.body.length, finalUrl: res.finalUrl },
      note: HEURISTIC_NOTE,
    };

    if (res.status !== 200) {
      return makeResult(META, 'fail', `Root URL returned HTTP ${res.status} (no manifest, no HTML to scan)`, evidence);
    }

    if (/navigator\.modelContext/.test(bodyText)) {
      return makeResult(META, 'pass', 'navigator.modelContext usage detected in root HTML (heuristic)', evidence);
    }

    return makeResult(META, 'fail', 'No /.well-known/webmcp manifest and no navigator.modelContext usage in root HTML', evidence);
  },
};

export default webmcp;

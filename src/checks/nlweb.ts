import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { fetchRobots, fetchText, getEvidence, isRecord, makeResult, memoize } from './_shared';

const SPEC = { url: 'https://github.com/nlweb-ai/NLWeb', asOf: '2026-10-22' };

interface AskEndpoint { url: string; works: boolean; streams: boolean; evidence: Evidence }

function getAskEndpoint(target: Target, http: HttpClient): Promise<AskEndpoint | null> {
  return memoize(`nlweb:${target.origin}`, async () => {
    for (const path of ['/ask', '/api/ask', '/nlweb/ask']) {
      const url = new URL(path, target.origin).toString();
      try {
        const res = await fetchText(url, http, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: 'test', query_id: 'agent-readiness-probe' }),
        });
        const evidence = getEvidence('POST', url, res);
        if (res.status !== 200) continue;
        let ok = false;
        try { ok = isRecord(JSON.parse(res.text)) || /text\/event-stream/i.test(res.contentType); } catch { /* not json */ }
        if (!ok && !/text\/event-stream/i.test(res.contentType)) continue;
        // streaming probe
        let streams = false;
        try {
          const sres = await fetchText(url, http, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ query: 'test', stream: true }),
          });
          streams = sres.status === 200 && /text\/event-stream/i.test(sres.contentType);
        } catch { /* no streaming */ }
        return { url, works: true, streams, evidence };
      } catch { /* next path */ }
    }
    return null;
  });
}

export const nlwebAsk: Check = {
  id: 'nlweb-ask',
  category: 'capabilities',
  title: 'NLWeb /ask endpoint',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'nlweb-ask', category: 'capabilities' as const, title: 'NLWeb /ask endpoint', spec: SPEC };
    const ep = await getAskEndpoint(target, http);
    if (!ep) return makeResult(meta, 'warn', 'No NLWeb /ask endpoint found at /ask, /api/ask, /nlweb/ask', {});
    return makeResult(meta, 'pass', `NLWeb ask endpoint answers at ${new URL(ep.url).pathname}`, ep.evidence);
  },
};

export const nlwebStreaming: Check = {
  id: 'nlweb-streaming',
  category: 'capabilities',
  title: 'NLWeb streaming support',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'nlweb-streaming', category: 'capabilities' as const, title: 'NLWeb streaming support', spec: SPEC };
    const ep = await getAskEndpoint(target, http);
    if (!ep) return makeResult(meta, 'skip', 'No /ask endpoint to check streaming on', {});
    if (ep.streams) return makeResult(meta, 'pass', 'Ask endpoint streams results via SSE', ep.evidence);
    return makeResult(meta, 'warn', 'Ask endpoint does not stream (no text/event-stream response)', ep.evidence);
  },
};

export const nlwebSchemaFeeds: Check = {
  id: 'nlweb-schema-feeds',
  category: 'content',
  title: 'NLWeb schema feeds (schemamap)',
  spec: SPEC,
  defaultEnabled: true,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'nlweb-schema-feeds', category: 'content' as const, title: 'NLWeb schema feeds (schemamap)', spec: SPEC };
    const robots = await fetchRobots(target.origin, http);
    if (robots.status === 200) {
      const line = robots.body.split(/\r?\n/).find((l) => /^\s*schemamap\s*:/i.test(l));
      if (line) return makeResult(meta, 'pass', `Schemamap directive: ${line.split(':').slice(1).join(':').trim()}`, robots.evidence);
    }
    const wk = await fetchText(new URL('/.well-known/feeds.json', target.origin).toString(), http);
    if (wk.status === 200 && /json/i.test(wk.contentType)) {
      return makeResult(meta, 'pass', 'Structured feeds at /.well-known/feeds.json', getEvidence('GET', wk.finalUrl, wk));
    }
    return makeResult(meta, 'warn', 'No Schemamap robots directive or /.well-known/feeds.json', robots.evidence);
  },
};

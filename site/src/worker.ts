// Runs only for the pages in MARKDOWN_PAGES (see run_worker_first in wrangler.jsonc); every other
// path is served straight from static assets. Returns the page's Markdown version when the request
// accepts text/markdown, and advertises that version with a Link header either way.
import { MARKDOWN_PAGES } from './markdown-pages';

interface Env {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
}

const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes';

/** True when the Accept header lists text/markdown with a non-zero quality. */
export function acceptsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  return accept.split(',').some((part) => {
    const [type, ...params] = part.trim().toLowerCase().split(';').map((s) => s.trim());
    if (type !== 'text/markdown') return false;
    const q = params.find((p) => p.startsWith('q='));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(headers)) out.headers.set(name, value);
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const mdPath = MARKDOWN_PAGES[url.pathname];
    if (!mdPath || (request.method !== 'GET' && request.method !== 'HEAD')) return env.ASSETS.fetch(request);

    const common = {
      Vary: 'Accept',
      Link: `<${mdPath}>; rel="alternate"; type="text/markdown"`,
      'Content-Signal': CONTENT_SIGNAL,
    };
    if (acceptsMarkdown(request.headers.get('Accept'))) {
      const md = await env.ASSETS.fetch(new URL(mdPath, url).toString());
      if (md.ok) return withHeaders(md, { ...common, 'Content-Type': 'text/markdown; charset=utf-8' });
    }
    return withHeaders(await env.ASSETS.fetch(request), common);
  },
};

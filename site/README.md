# agent-readiness site

The landing page for agent-readiness, on Cloudflare Workers: static assets plus a small Worker for Markdown content negotiation.

```sh
cd site
bun install
bun run build    # writes dist/ (see below)
bun run dev      # build, then wrangler dev
bun run deploy   # build, then wrangler deploy
```

- Pages are rendered at build time from TypeScript (`src/pages.ts`) with plain CSS (`src/styles.ts`), written to `/assets/site.css` and `/assets/site.js`. No framework, nothing loaded from other origins.
- `/example/` is the real HTML report (`formatHtml`) for `src/sample-report.ts`. That report uses the live check registry and remediation module, so check ids, titles and counts stay in sync with the CLI.
- `/scan/` is a placeholder until the hosted scanner ships: it turns the submitted URL into a ready-to-run CLI command.
- The site passes its own scan: `robots.txt` with a Content-Signal policy and explicit AI-bot groups, `sitemap.xml` and `sitemap.md`, `llms.txt` and `llms-full.txt`, `AGENTS.md`, an Agent Skill under `/.well-known/agent-skills/`, TDMRep, JSON-LD, and a Markdown version of each page (`/index.md`, `/example/index.md`). Its API and auth checks (OAuth, A2A, MCP, API catalog, OpenAPI, Web Bot Auth) fail by design: the site has no API.
- `src/worker.ts` runs only for `/` and `/example/` (`run_worker_first`). It returns the Markdown version for `Accept: text/markdown` and sets `Vary: Accept`, a `Link` to the Markdown version and the Content-Signal header. Everything else is plain static assets with headers from `_headers`.
- Absolute URLs (sitemap, canonical links, robots.txt) use `SITE_URL` from `src/config.ts`, `https://agent-readiness-site.itaios052.workers.dev` by default. Build with `SITE_URL=https://your.domain bun run build` after adding a custom domain.

Check it locally: `bun run dev`, then from the repo root `bun run src/cli.ts http://127.0.0.1:8787 --preset content --include-llms-txt --include-agents-md`.

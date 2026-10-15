# agent-readiness site

The landing page for agent-readiness, served as static assets on Cloudflare Workers.

```sh
cd site
bun install
bun run build    # writes dist/: landing, /scan/, /example/, robots.txt, llms.txt, 404
bun run dev      # build, then wrangler dev
bun run deploy   # build, then wrangler deploy
```

- Pages are rendered at build time from TypeScript (`src/pages.ts`) with plain CSS (`src/styles.ts`). No framework, no client bundle, nothing loaded from other origins.
- `/example/` is the real HTML report (`formatHtml`) for `src/sample-report.ts`. That report uses the live check registry and remediation module, so check ids, titles and counts stay in sync with the CLI.
- `/scan/` is a placeholder until the hosted scanner ships: it turns the submitted URL into a ready-to-run CLI command.

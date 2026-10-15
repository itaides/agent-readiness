# Roadmap

Updated 2026-08-04. A feature moves into scored defaults only when its public detection surface and pass criteria are stable enough to avoid guessing.

## Shipped in the current development version

- A2A Agent Card discovery and current required-field validation.
- Agent Skills discovery v0.2 validation and optional artifact digest verification.
- Content Signals yes/no values, path scope, optional `use`, and response-header detection.
- Informational DNS-AID draft discovery with local-target skip and explicit DNSSEC limitation.
- Informational Search/Agent/Training bot policy matrix.
- API-focused `auth.md` guidance check.
- Opt-in Lighthouse Agentic Browsing audit.
- Explicit-scope UCP, x402 v2, and MPP commerce checks.
- Read-only MCP 2026-07-28 `server/discover` probe.
- Regression-only `--baseline`, spec staleness audit, and remediation prompt package.
- Page-level readability: `page-html-quality`, `json-ld`, `freshness-signals`, `semantic-controls`.
- Markdown layer: `markdown-mirror`, `markdown-link-rel`, `llms-full-txt`, `sitemap-md`, `Vary: Accept` correctness on content negotiation.
- Discovery and instruction files: `agents-md` (opt-in), `agents-txt`/`agents.json`, `openapi-discovery`, `sitemap-lastmod`, `rss-atom`.
- Bot-blocking detection: `x-robots-tag`, `tdmrep`, `bot-ua-differential`.
- 0–100 score with letter grade on every report, and `--crawl <n>` sampled multi-page aggregation.

## Stabilization work

- Replace the fetch-only WebMCP heuristic when a stable browser/CDP interface is broadly available; until then runtime results remain informational.
- Promote MCP 2026-07-28 discovery only after the release candidate becomes a final default protocol version.
- Add portable DNSSEC validation evidence for DNS-AID without sending target data to a third-party resolver.
- Expand deterministic fixtures for browser and DNS paths in CI environments that provide Chrome and a controllable DNS server.
- Revisit the Cloudflare bot taxonomy and maintained user-agent mappings at least every six months.

## Next: hosted scanner

- A free web scanner on the project site: public reports at `/score/<domain>`, unlisted links at `/r/<token>`, 30 scans a day, a 6-hour cache, public addresses only. Design and backend rules: [`hosted-scanner-design.md`](hosted-scanner-design.md).

## Watchlist

- **ACP**: the API specification exists, but a stable site-level discovery signal is not yet clear enough for an external scanner.
- **AP2**: visible in emerging Cloudflare readiness schemas, but not yet a stable public check with defensible pass criteria.

Neither watchlist item ships as a placeholder check: the project continues to require observable pass criteria before implementation.

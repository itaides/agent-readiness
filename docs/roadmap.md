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
- ARD / AI Catalog discovery family (`ard.json`, `ai-catalog.json`, entry validity, trust manifest) plus agent discovery/plugin manifests.
- Content-quality family: metadata completeness, JSON-LD entity linking + Organization/schema breadth, accessibility surface (ax-*), llms.txt quality, markdown frontmatter/fences, redirect hygiene, agent-friendly 404s, pricing, trust anchors, token budget, `?mode=agent`, docs auth gating.
- API-quality family: OpenAPI quality (reachable endpoints, schema coverage, typed errors, versioning, pagination, async jobs, batch, `Idempotency-Key`, rate-limit headers, function-calling compat, JSON error bodies) and GraphQL mirrors.
- Deep read-only MCP family via `--mcp-url` (initialize, tool/resource listing + quality, transport, auth, OAuth/PKCE, MCP Apps + view CSP).
- Agent-auth (`agent_auth` metadata) and PAP/Poppy draft families as informational checks; auth.md structure/endpoint quality.
- Informational ACP (`checkout_sessions`, delegate payment) and AP2 (mandate markers) probes behind `--commerce-url`.
- Opt-in third-party directory lookups via `--external-lookups` (MCP registry, Wikidata, npm/PyPI, skills.sh).
- `robots.txt` AI-search/agent-user policy quality; NLWeb `/ask` + streaming + schema feeds; `/.well-known/mcp` discovery; Link-header discovery.

## Stabilization work

- Replace the fetch-only WebMCP heuristic when a stable browser/CDP interface is broadly available; until then runtime results remain informational.
- Promote MCP 2026-07-28 discovery only after the release candidate becomes a final default protocol version.
- Promote deep-MCP checks (tool quality, transport, OAuth/PKCE) from informational to scored once the Streamable-HTTP + SEP-1649 discovery path settles.
- Promote PAP/Poppy checks when the draft reaches a stable published spec; endpoints and field names may still move.
- Promote ACP/AP2 probes once their site-level discovery signals stabilize.
- Add portable DNSSEC validation evidence for DNS-AID without sending target data to a third-party resolver.
- Expand deterministic fixtures for browser and DNS paths in CI environments that provide Chrome and a controllable DNS server.
- Revisit the Cloudflare bot taxonomy and maintained user-agent mappings at least every six months.

## Watchlist

- **Live agent simulation / LLM-judged checks**: search share-of-voice, simulated onboarding, and answer-quality scoring require an LLM or live search in the loop — out of scope for a deterministic CI linter by design.

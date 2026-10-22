# Roadmap

Updated 2026-10-22. A feature moves into scored defaults only when its public detection surface and pass criteria are stable enough to avoid guessing.

## Shipped in the current development version

- A2A Agent Card discovery and current required-field validation.
- Agent Skills discovery v0.2 validation and optional artifact digest verification.
- Content Signals yes/no values, path scope, optional `use`, and response-header detection.
- Informational DNS-AID draft discovery with local-target skip and explicit DNSSEC limitation.
- Informational Search/Agent/Training bot policy matrix.
- API-focused `auth.md` guidance check plus structure/endpoint-reachability quality.
- Opt-in Lighthouse Agentic Browsing audit.
- Explicit-scope UCP, x402 v2, and MPP commerce checks, plus informational ACP/AP2 probes.
- Read-only MCP 2026-07-28 `server/discover` probe plus a deep `--mcp-url` family (initialize, tool/resource listing, transport, auth, PKCE, MCP Apps).
- ARD / AI Catalog discovery family (`ard.json`, `ai-catalog.json`, entry validity, trust manifest).
- Content-quality family: no-JS readability, metadata, JSON-LD/schema breadth, entity linking, llms.txt quality, markdown fallbacks, redirect hygiene, agent-friendly 404s, pricing, trust anchors, token budget.
- API-quality family: OpenAPI discovery, schema coverage, typed errors, versioning, pagination, async jobs, batch endpoints, idempotency keys, rate-limit headers, function-calling compatibility, GraphQL mirrors.
- Live bot-UA reachability probes (GPTBot/ClaudeBot/PerplexityBot) for WAF/CDN blocking detection.
- Agent-auth (`agent_auth` metadata) and PAP/Poppy draft families as informational checks.
- Opt-in third-party directory lookups via `--external-lookups` (MCP registry, Wikidata, npm/PyPI, skills.sh).
- Regression-only `--baseline`, spec staleness audit, and remediation prompt package.

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

- **Live agent simulation / LLM-judged checks**: search-share-of-voice, simulated onboarding, and answer-quality scoring require an LLM or live search in the loop — out of scope for a deterministic CI linter by design.

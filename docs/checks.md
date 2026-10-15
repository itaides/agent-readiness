# Agent Readiness — Checks Specification

This is the source of truth for the CLI's externally observable pass criteria. Every check records the linked source and the date it was last reviewed. Draft and runtime-dependent checks are informational and do not affect category totals.

## Scan model

- Origin checks derive scheme, host, and port from the input URL.
- Content checks use the input URL or `--content-url`.
- Commerce checks run only when `--commerce-url` is provided and are skipped for loopback/RFC1918/IPv6 ULA targets.
- `--preset content|api|commerce` narrows the scan to the relevant surface; the commerce preset still requires `--commerce-url`.
- MCP discovery runs only when `--mcp-url` is provided.
- Browser audits run only with `--browser` and require Lighthouse 13.3+, Node, and Chrome 150+.
- HTTP follows up to five redirects, reads at most 5 MB per response, and defaults to a five-second per-request timeout.
- JSON endpoints must return HTTP 200, a JSON-compatible content type, parseable JSON, and the required shape. A `200 text/html` SPA fallback fails.

Statuses are `pass`, `fail`, `warn`, and `skip`. Only checks marked **scored** contribute to category totals. Informational checks use warnings for absence or inconclusive detection.

## Discoverability

### `robots-txt` — scored, default

`GET /robots.txt`. Passes on HTTP 200, an absent content type or `text/plain`, and at least one `User-agent:` directive. Source: [RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309).

### `sitemap` — scored, default

`GET /sitemap.xml`; if unavailable, follows the first `Sitemap:` URL in `robots.txt`. Passes on HTTP 200, an XML content type, and a body beginning with an XML declaration, `urlset`, or `sitemapindex`. Source: [Sitemaps protocol](https://www.sitemaps.org/protocol.html).

### `link-header-api-catalog` — scored, default

`GET /`. Passes when the response contains a `Link` header with `rel="api-catalog"`. Source: [RFC 8288](https://datatracker.ietf.org/doc/html/rfc8288).

### `dns-aid` — informational, default

Queries SVCB/HTTPS at `_index._agents.<hostname>`. Passes when at least one service record exists, warns when absent, and skips local/private targets. Node/Bun's resolver API does not expose the DNSSEC AD bit, so evidence explicitly reports DNSSEC as unknown. Source: [DNS-AID Internet-Draft](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/).

### `sitemap-lastmod` — informational, default

Fetches the sitemap (well-known path or robots-discovered). Passes when ≥80% of `<url>` entries carry `<lastmod>`; warns below that or when no sitemap exists. Source: [Sitemaps protocol](https://www.sitemaps.org/protocol.html).

### `rss-atom` — informational, default

Finds RSS/Atom feeds via `Link` headers or `<link rel="alternate">` on the content page and validates the feed starts as XML (`<?xml`, `<rss`, or `<feed`). Warns when absent. Source: [RSS 2.0](https://www.rssboard.org/rss-specification).

## Content

### `markdown-negotiation` — scored, default

Requests the content URL with `Accept: text/markdown`. Passes on HTTP 200, `text/markdown`, a non-empty body, and content that does not look like HTML. A markdown response without `Vary: Accept` warns — shared caches can otherwise serve the wrong representation. Source: [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/).

### `llms-txt` — scored, opt-in

Enabled with `--include-llms-txt` or `--only llms-txt`. `GET /llms.txt` must return HTTP 200 as `text/plain` or `text/markdown`, be non-empty, and contain an H1. Source: [llms.txt proposal](https://llmstxt.org/).

### `llms-full-txt` — scored, opt-in

Enabled with `--include-llms-txt` or `--only llms-full-txt`. `GET /llms-full.txt` must return HTTP 200 as `text/plain` or `text/markdown` and be non-empty. Source: [llms.txt proposal](https://llmstxt.org/).

### `markdown-mirror` — scored, default

Probes the content URL's `.md` mirror (`<path>.md`, `<path>/index.md`, or `<page>.html.md`), preferring a `Link` header or `<link rel="alternate" type="text/markdown">` advertisement when present. Passes on HTTP 200 markdown/plain content that is not HTML. Source: [llms.txt proposal](https://llmstxt.org/) and [Vercel `.md` endpoints](https://vercel.com/docs/agent-resources/markdown-access).

### `markdown-link-rel` — informational, default

Passes when the content page advertises `rel="alternate" type="text/markdown"` or `rel="describedby"` via `Link` header or `<link>` tag. Warns when absent. Source: [llms.txt link relations](https://llmstxt.org/).

### `sitemap-md` — informational, default

`GET /sitemap.md`. Passes on markdown content containing at least one markdown link; warns otherwise. Source: [Vercel agent-readability spec](https://vercel.com/kb/guide/agent-readability-spec).

### `agents-md` — scored, opt-in

Enabled with `--include-agents-md` or `--only agents-md`. Probes `/AGENTS.md`, `/agents.md`, `/.well-known/agents.md`, `/CLAUDE.md`, `/claude.md`. Passes on non-empty markdown covering ≥2 of install/config/usage; warns when a file exists but is thin. Source: [agents.md](https://agents.md/) and the [Vercel spec](https://vercel.com/kb/guide/agent-readability-spec).

### `page-html-quality` — scored, default

Fetches the content URL. Fails on non-200, non-`text/html`, more than one redirect hop, or a text-to-HTML ratio ≤15% (SPA shell). Warns when readable but missing `<html lang>`, meta description ≥50 chars, `og:title`/`og:description`, a canonical link, or ≥3 h1–h3 headings. Source: [Vercel agent-readability spec](https://vercel.com/kb/guide/agent-readability-spec).

### `json-ld` — scored, default

Extracts `application/ld+json` blocks from the content page. Passes when ≥1 block parses and declares `@type`; fails on no blocks or unparseable blocks; warns when only microdata/RDFa is present. Source: [Schema.org](https://schema.org/).

### `freshness-signals` — informational, default

Reports JSON-LD `datePublished`/`dateModified`, `<time datetime>`, article/og time meta, or a `Last-Modified` header on the content page. Warns when none exist. Source: [agent-ready.dev](https://agent-ready.dev/what-is-an-agent-ready-website).

### `semantic-controls` — informational, default

Fetch-only heuristic for browser-driving agents: counts `<a href>`/`<button>` controls, flags `onclick` handlers on non-interactive elements, majority-generic link text, and unlabelled inputs. Source: [axd.md](https://axd.md/).

## Bot access and content policy

### `content-signal` — scored, default

Checks both `Content-Signal:` directives in `robots.txt` and the `Content-Signal` header on the content response. Core values `search`, `ai-input`, and `ai-train` accept only `yes`/`no`; the optional `use` extension accepts `immediate`, `reference`, or `full`. Path-scoped robots directives are supported. The score measures a valid explicit policy, not whether it allows or denies use. Sources: [Content Signals](https://contentsignals.org/) and [Cloudflare header behavior](https://developers.cloudflare.com/changelog/post/2026-07-13-markdown-for-agents-header-preservation/).

### `ai-bot-rules` — scored, default

Passes when `robots.txt` explicitly names at least one known AI crawler or user-directed agent. It does not score the allow/block stance. The maintained names cover OpenAI, Anthropic, Perplexity, Google, Apple, Meta, Amazon, Common Crawl, ByteDance, and Cohere agents.

### `bot-policy-matrix` — informational, default

Reports explicit `robots.txt` stance for Cloudflare's current Search, Agent, and Training behavior buckets. Warns when none of the mapped bots has an explicit group. It is a policy inventory, not a recommendation to allow or block a category. Source: [Cloudflare Verified bots taxonomy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/).

### `x-robots-tag` — scored, default

Reads `X-Robots-Tag` on the content response. Passes when absent or non-restrictive; fails on `noindex`, `nosnippet`, `noai`, `noimageai`, `none`, `unavailable_after`, or bot-scoped directives such as `GPTBot: noindex`. Source: [Robots meta tag spec](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

### `tdmrep` — informational, default

Reports any TDM policy signal: `TDM-Reservation` response header, `<meta tdm-reservation>`, `/.well-known/tdmrep.json`, or `/ai.txt`. Warns when none exist. Source: [TDMRep](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/).

### `bot-ua-differential` — scored, default

Fetches the content URL with a browser UA, then `GPTBot` and `ClaudeBot` UAs. Fails when a bot UA gets 401/403/429 while the browser gets 200; warns on other status or large body-size differentials; passes on identical treatment. Source: [Cloudflare verified bots](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/).

### `web-bot-auth` — scored, default

`GET /.well-known/http-message-signatures-directory`. Accepts a top-level key array or `{ "keys": [...] }`; at least one entry must look JWK-like via `kid` or `kty`. Source: [HTTP Message Signatures draft](https://datatracker.ietf.org/doc/draft-ietf-httpbis-message-signatures/).

## Capabilities

### `a2a-agent-card` — scored, default

`GET /.well-known/agent-card.json`. Validates the current A2A required fields: non-empty name/description/version, capabilities object, supported interfaces, default input/output modes, and skills. Interfaces need URL, protocol binding, and protocol version; skills need ID, name, description, and tags. Source: [A2A specification](https://a2a-protocol.org/dev/specification/).

### `agent-skills` — scored, default

`GET /.well-known/agent-skills/index.json`. Requires the v0.2 schema URI and a non-empty skills array. Every entry needs a valid unique name, `skill-md` or `archive` type, 1–1024 character description, URL, and lowercase SHA-256 digest. `--verify-skill-digests` also fetches each advertised HTTP(S) artifact and compares its bytes to the digest. Source: [Cloudflare Agent Skills discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc).

### `api-catalog` — scored, default

`GET /.well-known/api-catalog`. Accepts an RFC 9727 linkset array or `{ "linkset": [...] }`. Source: [RFC 9727](https://datatracker.ietf.org/doc/html/rfc9727).

### `oauth-authorization-server` — scored, default

`GET /.well-known/oauth-authorization-server`. Requires a non-empty `issuer`. Source: [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414).

### `oauth-protected-resource` — scored, default

`GET /.well-known/oauth-protected-resource`. Requires a non-empty `resource`. Source: [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728).

### `mcp-server-card` — scored, default

`GET /.well-known/mcp/server-card.json`. Requires `transport` and `serverInfo.name`; accepts both the older card with `protocolVersion` and the SEP-1649-style card without it. Source: [MCP Server Card schema](https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json).

### `webmcp` — informational, default

Passes on a JSON object at `/.well-known/webmcp` or inline `navigator.modelContext` usage. Absence is only a warning because fetch-only inspection cannot see registrations in external JavaScript. Use `--browser` for runtime evidence.

### `agents-txt` — informational, default

`GET /agents.json` then `/agents.txt`. Passes on a valid JSON object or non-empty text capability declaration; warns when absent (emerging convention). Source: [agents-txt spec](https://agents-txt.com/).

### `openapi-discovery` — scored, default

Probes `/openapi.json`, `/openapi.yaml`, `/swagger.json`, `/api/openapi.json`, `/api-docs`, `/docs/openapi.json`, `/.well-known/openapi.json`. Passes when a document parses with an `openapi`/`swagger` version field. Source: [OpenAPI Specification](https://spec.openapis.org/oas/latest.html).

### `auth-md` — informational, opt-in

Enabled with `--include-auth-md` or `--only auth-md`. `GET /auth.md` should return Markdown/plain text with an `# auth.md` heading and point to `/.well-known/oauth-protected-resource`. Warnings do not supersede the structured OAuth metadata, which remains authoritative. Source: [auth.md documentation](https://workos.com/auth-md/docs/auth-md).

### `mcp-server-discover` — informational, opt-in

Enabled by `--mcp-url`. Sends one read-only JSON-RPC `server/discover` request using the MCP 2026-07-28 release candidate headers and per-request metadata. Passes when the result includes `supportedVersions` and `capabilities`; it never invokes a tool, prompt, or resource. Source: [MCP draft discovery](https://modelcontextprotocol.io/specification/draft/server/discover).

### `browser-agentic` — informational, opt-in

Enabled by `--browser`. Runs Lighthouse's `agentic-browsing` category against the content URL and reports its pass ratio plus failed audit IDs. Failures are warnings because the category and WebMCP support are experimental and unbenchmarked. Source: [Chrome Agentic Browsing scoring](https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring).

## Commerce

Commerce checks activate together when `--commerce-url <paid-resource>` is supplied.

### `ucp` — scored when activated

`GET /.well-known/ucp`. Requires a top-level `ucp` object with a `YYYY-MM-DD` version plus object-valued `services` and `payment_handlers`. Source: [UCP specification](https://ucp.dev/specification/overview/).

### `x402` — scored when activated

Requests the paid resource without payment. Requires HTTP 402 and a `PAYMENT-REQUIRED` header containing valid Base64 JSON with `x402Version: 2` and a non-empty `accepts` array. The check never pays or retries. Source: [x402 HTTP 402](https://docs.x402.org/core-concepts/http-402).

### `mpp` — scored when activated

Requests the paid resource without payment. Requires HTTP 402 and at least one `WWW-Authenticate: Payment` challenge. The check never sends an authorization credential or payment. Source: [Machine Payments Protocol](https://mpp.dev/).

## Baseline behavior

`--baseline <path>` loads a prior JSON report after the current scan:

- prior `pass` → current `fail`: regression, exit 1;
- prior `fail` → current `pass`: improvement;
- new failing check: regression;
- new passing check: improvement;
- removed check: warning;
- target mismatch or invalid baseline: exit 2;
- `warn`, `skip`, messages, and evidence do not gate CI.

Without `--baseline`, completed scans exit 0 even when checks fail. Network/target errors exit 2 and uncaught tool errors exit 3.

## Remediation guidance

Every `fail` or `warn` result includes structured remediation with a concise suggestion and a target-specific command that reruns only that check. Human, Markdown, and HTML reports render this guidance directly; JSON includes it under `checks[].remediation`. Where a longer coding-agent prompt exists, `promptPath` points to its packaged file under `prompts/`.

Guidance is capability-aware: optional protocols are phrased as conditional recommendations, informational drafts remain low priority, bot policy suggestions preserve the site owner's allow/block decision, and commerce verification never submits payment or credentials.

## Inventory

| Category | Available | Default | Scored by default |
|---|---:|---:|---:|
| Discoverability | 6 | 6 | 3 |
| Content | 11 | 8 | 4 |
| Bot access | 7 | 7 | 5 |
| Capabilities | 12 | 9 | 7 |
| Commerce | 3 | 0 | 0 |
| **Total** | **39** | **30** | **19** |

`llms-txt`, `llms-full-txt`, and `agents-md` raise the scored total to 22. Supplying `--commerce-url` adds three commerce checks. Informational checks never change totals.

## Aggregate score

Every report includes `score`: `passed / total × 100` over scored checks (statuses pass|fail only), plus a letter grade (A+ ≥97, A ≥90, B ≥80, C ≥70, D ≥50, F <50). Informational and skipped checks never count.

## Crawl sampling

`--crawl <n>` samples up to `n` URLs evenly across the discovered sitemap and runs the page-scoped checks (`pageScoped` on the check) against each, aggregating per-check pass/warn/fail counts under `report.crawl`. It shares the scan's HTTP client, timeouts, and injected headers.

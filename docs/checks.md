# Agent Readiness — Checks Specification

This is the source of truth for the CLI's externally observable pass criteria. Every check records the linked source and the date it was last reviewed. Draft and runtime-dependent checks are informational and do not affect category totals.

## Scan model

- Origin checks derive scheme, host, and port from the input URL.
- Content checks use the input URL or `--content-url`.
- Commerce checks run only when `--commerce-url` is provided and are skipped for loopback/RFC1918/IPv6 ULA targets.
- `--preset content|api|commerce` narrows the scan to the relevant surface; the commerce preset still requires `--commerce-url`.
- MCP discovery and deep MCP checks run only when `--mcp-url` is provided; probes are read-only (`initialize`, `tools/list`, `resources/list`) and never invoke a tool, prompt, or resource.
- Agent-auth checks run with `--include-auth-md`.
- External directory lookups (MCP registry, Wikidata, npm/PyPI, skills.sh) run only with `--external-lookups` and send the target's domain/name to third-party APIs.
- Browser audits run only with `--browser` and require Lighthouse 13.3+, Node, and Chrome 150+.
- HTTP follows up to five redirects, reads at most 5 MB per response, and defaults to a five-second per-request timeout.
- JSON endpoints must return HTTP 200, a JSON-compatible content type, parseable JSON, and the required shape. A `200 text/html` SPA fallback fails. Text/markdown checks likewise reject HTML bodies.

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

### `ard-catalog` — scored, default

Resolves the site's ARD (Agentic Resource Discovery) catalog: `/.well-known/ard.json` first, then `Link`/`rel` discovery on the homepage, then the legacy `/.well-known/ai-catalog.json`. Passes when a parseable catalog document is found; discovery via the legacy path warns to migrate to `ard.json`. Source: [Agentic Resource Discovery](https://agenticresourcediscovery.org/).

### `ard-entries-valid` — informational, default

Validates ARD catalog entries: each must carry a `urn:air`-style id, a name, a media type, and at least one resolvable target. Skips when no catalog exists.

### `ard-trust-manifest` — informational, default

Passes when the catalog or its entries advertise `trustManifest`/signature fields so agents can verify resource provenance. Skips without a catalog.

### `ai-catalog-published` — informational, default

`GET /.well-known/ai-catalog.json` requires a top-level `specVersion`. Skips when the canonical `ard.json` is already published (the alias is optional).

### `noindex-directives` — scored, default

Fails when the homepage sends `X-Robots-Tag: noindex/none` or a `<meta name="robots" content="noindex">` directive, which removes the site from search and AI answers entirely. Source: [robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

### `agent-discovery-file` — informational, default

`GET /.well-known/agent.json` (or `/agent.json`, `/.well-known/agents.json`). Passes when the document carries descriptive fields such as name/description/services for arriving agents.

### `agent-plugins-repo` — informational, default

`GET /.well-known/ai-plugin.json` or `/.well-known/plugin.json`. Passes on a plugin manifest with plugin-like fields (name, description, api/schema fields).

### `agent-rules-repo` — informational, default

Probes `/AGENTS.md` and `/CLAUDE.md`. Passes when a real text/markdown rules file exists so coding agents get repo-style guidance.

### `mcp-registry-listed` — informational, opt-in

With `--external-lookups`, queries the official MCP registry API for a server entry matching the site's name or domain.

### `registry-branding` — informational, opt-in

With `--external-lookups`, checks whether the MCP registry entry carries branding metadata (icon/description/homepage) rather than a bare listing.

### `wikipedia-presence` — informational, opt-in

With `--external-lookups`, queries Wikidata for an entity matching the site's name or domain — a presence signal LLMs use heavily for entity grounding.

## Content

### `markdown-negotiation` — scored, default

Requests the content URL with `Accept: text/markdown`. Passes on HTTP 200, `text/markdown`, a non-empty body, and content that does not look like HTML. Source: [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/).

### `llms-txt` — scored, opt-in

Enabled with `--include-llms-txt` or `--only llms-txt`. `GET /llms.txt` must return HTTP 200 as `text/plain` or `text/markdown`, be non-empty, and contain an H1. Source: [llms.txt proposal](https://llmstxt.org/).

### `content-no-js` — scored, default

Parses the raw HTML of the content URL without executing JavaScript. Passes on ≥500 characters of visible text plus an `<h1>`; warns when text exists but no H1; fails when the page is a JS-shell (like an SPA `<div id="root">`).

### `sitemap-lastmod` — informational, default

Reads the resolved sitemap and extracts `<lastmod>` dates. Passes when dates parse and the newest is under ~18 months old; warns on missing or stale dates. Skips when no sitemap exists.

### `metadata-completeness` — informational, default

Parses the homepage for `<title>`, meta description, canonical URL, `html lang`, `og:image`, and `og:type`. Passes when all present; warns with the missing list.

### `json-ld` — informational, default

Extracts `application/ld+json` blocks. Passes when at least one block parses and declares `@type`; warns on zero blocks, parse failures, or missing types. Source: [schema.org](https://schema.org/).

### `json-ld-entity-linking` — informational, default

Passes when JSON-LD entities carry `sameAs` links to official profiles (Wikipedia, GitHub, LinkedIn, X, Crunchbase…), which grounds the entity for AI answer engines. Skips without JSON-LD.

### `org-schema-completeness` — informational, default

Passes when an `Organization` JSON-LD node carries `name`, `url`, `logo`, and contact details (`contactPoint`/`email`).

### `schema-type-breadth` — informational, default

Passes when the page declares ≥2 distinct schema.org types (Article, FAQPage, Product, Organization, BreadcrumbList…); warns on one or none.

### `llms-txt-formatting` — informational, opt-in

Enabled with `--include-llms-txt`. Passes when `llms.txt` has an H1, at least one H2 section, and ≥3 curated links.

### `llms-txt-links-resolve` — informational, opt-in

Enabled with `--include-llms-txt`. Samples up to five links from `llms.txt` and passes when all resolve with HTTP <400.

### `modular-llms-txt` — informational, opt-in

Enabled with `--include-llms-txt`. Passes when `llms.txt` links to at least one additional `.md`/`.txt` doc, indicating modular per-area files.

### `markdown-url-fallback` — informational, default

Passes when appending `.md` (or `/index.md`) to the content URL returns real markdown — a zero-negotiation fallback for crawlers.

### `markdown-link-alternate` — informational, default

Passes when the HTML `<head>` advertises `<link rel="alternate" type="text/markdown">` pointing at a working markdown URL.

### `markdown-negotiation-vary` — informational, default

Passes when the markdown-negotiated response includes `Vary: Accept` (or `Accept` in the Vary list), keeping caches honest for content negotiation.

### `markdown-frontmatter` — informational, default

Passes when the negotiated markdown carries YAML frontmatter with a `title`, helping agents attribute the content. Skips when markdown isn't served.

### `page-token-budget` — informational, default

Measures extracted page text against an agent token budget (~25k tokens / ~100k chars). Passes when content fits; warns when oversized or too thin to evaluate (<500 chars).

### `code-fence-validity` — informational, default

Parses the negotiated markdown for fenced code blocks. Passes when fences are balanced; warns on unclosed fences. Skips when markdown isn't served.

### `redirect-hygiene` — informational, default

Passes when the content URL is reachable without meta-refresh tags, JS-only redirects (`location.replace`/`location.href`), or long redirect chains.

### `agent-friendly-404` — scored, default

Requests a guaranteed-missing path. Passes on real HTTP 404/410 (bonus when the body is markdown); fails on HTTP 200 soft-404/SPA fallthrough, which misleads agents and crawlers.

### `pricing-md` — informational, default

`GET /pricing.md`. Passes on a real text/markdown pricing file.

### `pricing-info` — informational, default

Follows homepage pricing/plans links and `/pricing`; passes when a page with readable price signals (`$`, `free`, `per month`, `pricing`…) resolves.

### `agent-mode-view` — informational, default

Requests the content URL with `?mode=agent`. Passes when it returns markdown/plain/JSON or a materially leaner HTML view.

### `trust-anchors` — informational, default

Samples `/about`, `/about-us`, `/contact`, `/privacy`, `/terms`, and `/.well-known/security.txt`. Passes when ≥2 resolve with real content; these pages let agents verify the operator's legitimacy.

### `public-api-docs` — informational, default

Passes when the homepage links to docs/api/developer pages that resolve, or when a discoverable OpenAPI spec exists as a fallback signal.

### `developer-portal` — informational, default

Passes when the homepage links to a self-serve developer portal/signup (console, dashboard, signup, get-started) that resolves.

### `agent-instruction` — informational, default

Passes when the site gives agents "when to use us" guidance via `llms.txt`, `agent.json`, or descriptive meta tags/schema.

### `docs-auth-gate` — informational, default

Samples internal docs-like links from the homepage; passes when all are publicly readable, warns on pages returning 401/403 or redirecting to login. Skips when no internal docs links exist.

### `nlweb-schema-feeds` — informational, default

Looks for a `schemamap` reference in `robots.txt` or a JSON feed manifest, indicating NLWeb-style structured data feeds. Source: [NLWeb](https://github.com/nlweb-ai/NLWeb).

### `mcp-well-known-discovery` — informational, default

`GET /.well-known/mcp` (and `/.well-known/mcp.json`). Passes when the well-known document advertises MCP endpoints or a server registry entry, enabling MCP discovery without a known URL.

### `link-headers-discovery` — informational, default

Passes when the homepage `Link` headers advertise at least one agent-relevant relation (`describedby`, `service-meta`, `api-catalog`, `documentation`, `.well-known` URIs).

## Bot access and content policy

### `content-signal` — scored, default

Checks both `Content-Signal:` directives in `robots.txt` and the `Content-Signal` header on the content response. Core values `search`, `ai-input`, and `ai-train` accept only `yes`/`no`; the optional `use` extension accepts `immediate`, `reference`, or `full`. Path-scoped robots directives are supported. The score measures a valid explicit policy, not whether it allows or denies use. Sources: [Content Signals](https://contentsignals.org/) and [Cloudflare header behavior](https://developers.cloudflare.com/changelog/post/2026-07-13-markdown-for-agents-header-preservation/).

### `ai-bot-rules` — scored, default

Passes when `robots.txt` explicitly names at least one known AI crawler or user-directed agent. It does not score the allow/block stance. The maintained names cover OpenAI, Anthropic, Perplexity, Google, Apple, Meta, Amazon, Common Crawl, ByteDance, and Cohere agents.

### `bot-policy-matrix` — informational, default

Reports explicit `robots.txt` stance for Cloudflare's current Search, Agent, and Training behavior buckets. Warns when none of the mapped bots has an explicit group. It is a policy inventory, not a recommendation to allow or block a category. Source: [Cloudflare Verified bots taxonomy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/).

### `web-bot-auth` — scored, default

`GET /.well-known/http-message-signatures-directory`. Accepts a top-level key array or `{ "keys": [...] }`; at least one entry must look JWK-like via `kid` or `kty`. Source: [HTTP Message Signatures draft](https://datatracker.ietf.org/doc/draft-ietf-httpbis-message-signatures/).

### `bot-detection` — scored, default

Refetches the homepage with GPTBot, ClaudeBot, and PerplexityBot user agents. Passes when all get HTTP <400 like the baseline; fails when AI crawlers get 403/401 while normal clients succeed (WAF/CDN blocking).

### `agent-crawler-reachability` — scored, default

Refetches the content URL with agent user agents (GPTBot, Claude-User, Perplexity-User). Passes when the content is reachable for agents; fails when agents are blocked while the default UA succeeds.

### `robots-ai-policy-quality` — informational, default

Reports the `robots.txt` stance for AI *search* crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot) — the agents that decide whether you appear in AI answers. Warns when search crawlers are disallowed.

### `robots-agent-user-policy` — informational, default

Reports the `robots.txt` stance for user-directed agents (ChatGPT-User, Claude-User, Perplexity-User). Warns when user-triggered fetches are disallowed.

### `agent-ua-markdown` — informational, default

Requests the content URL with an AI-bot user agent plus `Accept: text/markdown`. Passes when bots can get markdown directly, without needing a human UA. Skips when markdown negotiation isn't supported at all.

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

### `oauth-support` — informational, default

Passes when RFC 8414 authorization-server metadata exists with `authorization_endpoint` and `token_endpoint`, or the well-known exists for a path-mounted issuer.

### `scoped-permissions` — informational, default

Passes when OAuth metadata declares `scopes_supported` with ≥2 entries — a proxy for scoped, least-privilege permissions agents can request.

### `openapi-spec` — informational, default

Discovers an OpenAPI 3.x document at common paths (`/openapi.json`, `/.well-known/openapi.json`, `/api/openapi.json`, `/api-docs`, `/docs/openapi.json`, `/swagger.json`) or via the api-catalog linkset. Passes when a parseable spec with `paths` is found.

### `public-api` — informational, default

Probes the spec's first GET operation (joined against `servers[0]` when present). Passes when it answers with a real status (<500) — proving the documented API is reachable.

### `response-schema-coverage` — informational, default

Measures the share of GET operations whose 2xx responses declare a JSON `content` schema. Passes at ≥80% coverage.

### `api-error-model` — informational, default

Passes when ≥60% of operations declare a non-2xx response with a schema, or components define reusable error types — a typed error model agents can branch on.

### `api-versioning-policy` — informational, default

Passes when the spec uses `/vN/` paths, `servers` URLs, deprecation flags, or version headers — any explicit versioning/deprecation policy.

### `pagination-shape` — informational, default

Passes when list-style operations declare cursor/offset/page/limit parameters or next-page fields — pagination agents can iterate programmatically.

### `async-job-pattern` — informational, default

Passes when the spec exposes a job/task pattern (POST returning 202, `status`-field polling endpoints, or `/jobs/`/`/tasks/` paths) for long-running work.

### `batch-endpoints` — informational, default

Passes when the spec exposes batch/bulk endpoints or operations accepting arrays — agents can collapse N calls into one.

### `idempotency-key-support` — informational, default

Passes when the spec or a live POST probe shows `Idempotency-Key` support, letting agents safely retry mutations.

### `function-calling-compat` — informational, default

Passes when operation parameters are plain JSON-schema objects with typed properties and `required` lists — directly mappable to function-calling tool schemas.

### `api-schema-analysis` — informational, default

Reports operation count, average parameter count, and share of operations with descriptions — a complexity signal for how much context an agent needs to use the API.

### `json-error-responses` — informational, default

Probes a guaranteed-missing API path. Passes when the 404 body is JSON (typed error) rather than HTML, so agents can parse failures.

### `rate-limit-headers` — informational, default

Probes a real API endpoint from the spec and inspects `RateLimit`/`X-RateLimit-*`/`Retry-After` headers. Passes when rate-limit semantics are declared in-band.

### `graphql-error-type-definition` — informational, default

POSTs an introspection-shaped probe to discovered GraphQL endpoints (`/graphql`, `/api/graphql`, `/.well-known/graphql`). Passes when errors are typed (`errors[]` with `extensions`/`code`). Skips when no endpoint exists.

### `graphql-versioning-policy` — informational, default

Passes when the schema exposes `__schema`/`__type` or the endpoint documents deprecation via `@deprecated` fields — agents can detect drift.

### `graphql-pagination-pattern` — informational, default

Passes when the schema uses connection-style pagination (`first`/`after`/`pageInfo`/`edges`).

### `graphql-async-job-pattern` — informational, default

Passes when the schema exposes job/task types or long-running mutation patterns.

### `graphql-schema-completeness` — informational, default

Passes when a meaningful share of types/fields carry descriptions — the documentation layer agents rely on.

### `graphql-batch-mutations` — informational, default

Passes when the schema supports batched/aliased operations or bulk mutation inputs.

### `onboarding-friction` — informational, default

Passes when self-serve onboarding exists: a reachable signup/console link, an OpenAPI doc with securitySchemes explaining auth, or documented token acquisition.

### `sandbox-environment` — informational, default

Passes when the homepage, docs, or OpenAPI spec references a sandbox/test/staging environment or test keys.

### `a2ui-support` — informational, default

Passes when the site exposes A2UI/generative-UI signals: MCP Apps resources, a `/.well-known/a2ui` document, or a2ui-capable MCP surfaces.

### `nlweb-ask` — informational, default

POSTs a trivial `{"query": "test"}` to `/ask`. Passes on a JSON answer or a structured NLWeb response; warns when absent. Source: [NLWeb](https://github.com/nlweb-ai/NLWeb).

### `nlweb-streaming` — informational, default

Checks whether the NLWeb endpoint advertises streaming (`text/event-stream`/SSE on the ask surface). Skips when no NLWeb endpoint exists.

### `mcp-server` — informational, opt-in

Enabled by `--mcp-url`. Sends a JSON-RPC `initialize` and passes on a valid `serverInfo`+`protocolVersion` response — the MCP equivalent of "is this server alive." Never invokes a tool.

### `mcp-server-identity` — informational, opt-in

Passes when `initialize` returns a non-empty `serverInfo.name` (and version), so hosts can display the server correctly.

### `mcp-tool-listing` — informational, opt-in

Calls `tools/list` after `initialize`. Passes when the server exposes ≥1 tool.

### `mcp-tool-descriptions` — informational, opt-in

Measures the share of tools with non-empty descriptions ≥20 chars. Passes at ≥80% coverage.

### `mcp-param-schemas` — informational, opt-in

Measures the share of tools whose `inputSchema` is a typed JSON-schema object. Passes at ≥80%.

### `mcp-tool-naming` — informational, opt-in

Passes when tool names are consistently slugged (`snake_case`/`kebab-case`/namespaced) rather than free-form sentences — agents match names to intent.

### `mcp-tool-annotations` — informational, opt-in

Passes when tools carry `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`…) so hosts can gate side effects.

### `mcp-error-handling` — informational, opt-in

Calls `tools/list` plus a deliberately-invalid JSON-RPC method. Passes when the server returns a structured JSON-RPC error rather than an HTTP 500/HTML error.

### `mcp-transport-modern` — informational, opt-in

Passes when the endpoint accepts Streamable HTTP (single-endpoint POST with `Accept: application/json, text/event-stream`), not only legacy HTTP+SSE.

### `mcp-auth-mechanism` — informational, opt-in

Reports the auth stance discovered on the endpoint: `WWW-Authenticate` challenge on 401, OAuth metadata, or explicit open access. Passes when auth is unambiguous.

### `mcp-oauth-metadata` — informational, opt-in

Passes when the MCP endpoint or origin publishes OAuth authorization-server / protected-resource metadata binding the MCP resource to its issuer.

### `mcp-pkce-s256` — informational, opt-in

Passes when the discovered OAuth metadata declares `code_challenge_methods_supported` including `S256`. Skips when no OAuth metadata exists.

### `mcp-resource-listing` — informational, opt-in

Calls `resources/list`. Passes when the server exposes resources (or an empty list without error — capability present).

### `mcp-resource-quality` — informational, opt-in

Measures the share of resources with `name`/`description` and a usable URI scheme. Passes at ≥80% coverage.

### `mcp-multi-surface-coverage` — informational, opt-in

Passes when the server combines tools *and* resources (or resource templates plus prompts), covering more than one MCP surface.

### `mcp-app-registry` — informational, opt-in

Passes when tools carry `ui`/`_meta["ui.resourceUri"]` markers or the server lists `ui://` resources — MCP Apps (interactive UI) support.

### `mcp-apps-ui-quality` — informational, opt-in

Passes when MCP App view resources return real HTML and reference the view's assets — i.e., the UI is actually loadable.

### `mcp-view-domain` — informational, opt-in

Passes when the MCP App view domain resolves and serves the view document to a normal HTTP client.

### `mcp-view-csp` — informational, opt-in

Passes when the MCP App view declares a `Content-Security-Policy`/frame metadata so hosts can render it safely.

### `agent-auth-discovery-metadata` — informational, opt-in

Enabled by `--include-auth-md`. Passes when `/.well-known/agent-auth` (or the auth.md-advertised endpoint) returns `agent_auth` discovery metadata with registration/verification endpoints. Source: [auth.md / agent-auth](https://workos.com/auth-md/docs/auth-md).

### `agent-auth-www-authenticate` — informational, opt-in

Enabled by `--include-auth-md`. Passes when a protected endpoint returns `WWW-Authenticate` carrying an agent-realm/challenge hint on 401.

### `agent-auth-endpoints-reachable` — informational, opt-in

Enabled by `--include-auth-md`. Probes the endpoints named in `agent_auth` metadata (`/agent/identity`, claim, event, revocation). Passes when they answer (including 401/405 — reachable, auth required).

### `auth-md-structure` — informational, opt-in

Enabled by `--include-auth-md`. Passes when `/auth.md` contains a discover/credentials/verify walkthrough structure (headings + endpoint references), not just prose.

### `auth-md-endpoints` — informational, opt-in

Enabled by `--include-auth-md`. Extracts endpoint URLs referenced in `/auth.md` and passes when they resolve or exist as well-known documents.

### `pap-discovery` — informational, default

`GET /.well-known/poppy.json`. Passes on a PAP (Personal Agent Protocol / Poppy) discovery document with issuer and interface declarations. Draft protocol — informational only.

### `pap-issuer-binding` — informational, default

Passes when `poppy.json` declares an `issuer` whose metadata document is fetchable, binding the PAP surface to a verifiable identity.

### `pap-auth-config` — informational, default

Passes when the PAP document declares a sign-in/auth interface (delegated auth endpoint or OAuth binding).

### `pap-interfaces` — informational, default

Passes when the PAP document advertises ≥2 of the expected interfaces (identity, auth, calendar/mail/tasks-style capabilities).

### `pap-endpoint-enforcement` — informational, default

Samples a PAP endpoint; passes when it requires auth (401) rather than serving personal data openly — enforcement exists.

### `pap-cross-protocol` — informational, default

Passes when `auth.md` or `ard.json` reference the same issuer as `poppy.json`, keeping the agent-auth story consistent across protocols.

### `npm-sdk-package` — informational, opt-in

With `--external-lookups`, searches npm/PyPI for an official SDK package matching the site name/domain.

### `rest-sdk-packages` — informational, opt-in

With `--external-lookups`, checks for SDK packages in ≥2 language ecosystems (npm, PyPI, RubyGems, Packagist, Maven).

### `cli-tool` — informational, opt-in

With `--external-lookups`, checks for an installable official CLI (npm bin, Homebrew formula, GitHub release binary naming).

### `skills-sh-listed` — informational, opt-in

With `--external-lookups`, queries skills.sh for a listed skill matching the site.

### `skills-sh-quality` — informational, opt-in

With `--external-lookups`, grades the skills.sh entry: description quality, install metadata, and linked repository presence.

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

### `acp-support` — informational, opt-in

With `--commerce-url`, probes the commerce origin's ACP `checkout_sessions` surface (`/checkout_sessions`, documented ACP paths). Passes when the endpoint exists and answers with a non-404 structured response. Never submits a payment. Source: [Agentic Commerce Protocol](https://www.agenticcommerce.dev/).

### `acp-delegate-payment` — informational, opt-in

With `--commerce-url`, checks whether the ACP surface advertises a `delegate_payment` endpoint (the agent-delegated payment step). Never sends credentials or payment details.

### `ap2-support` — informational, opt-in

With `--commerce-url`, looks for AP2 (Agent Payments Protocol) signals: `/.well-known/ap2` or x402/MPP payment-mandate fields. Passes on any verifiable AP2 marker. Source: [AP2 protocol](https://ap2-protocol.org/).

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

Every `fail` or `warn` result includes structured remediation with a concise suggestion and a target-specific command that reruns only that check. Human, Markdown, and HTML reports render this guidance directly; JSON includes it under `checks[].remediation`. Where a longer coding-agent prompt exists, `promptPath` points to its packaged file under `prompts/`; checks without a bespoke entry fall back to a generic suggestion plus the targeted re-run command.

Guidance is capability-aware: optional protocols are phrased as conditional recommendations, informational drafts remain low priority, bot policy suggestions preserve the site owner's allow/block decision, and commerce verification never submits payment or credentials.

## Inventory

| Category | Available | Default | Scored by default |
|---|---:|---:|---:|
| Discoverability | 15 | 12 | 5 |
| Content | 31 | 27 | 3 |
| Bot access | 9 | 9 | 5 |
| Capabilities | 71 | 39 | 6 |
| Commerce | 6 | 0 | 0 |
| **Total** | **132** | **87** | **19** |

`llms-txt` raises the scored total to 20; commerce (`--commerce-url`) can add three scored checks (UCP/x402/MPP) for a maximum of 23 scored. Informational checks never change totals. Deep-MCP checks activate with `--mcp-url`, agent-auth checks with `--include-auth-md`, and third-party directory lookups with `--external-lookups`.

## Deliberately not implemented

Some Ora-style signals are intentionally out of scope because they cannot be checked deterministically against a local/private target:

- **Search-engine visibility** (brand-search accuracy, category share-of-voice) — requires live search results.
- **LLM-judged quality** (content "answerability", simulated onboarding) — requires an LLM in the loop.
- **Live tool/prompt invocation** — the scanner is read-only by design; it lists MCP tools/resources but never calls them.
- **Payment completion** — commerce checks observe 402 challenges only and never pay.

# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project will adopt [Semantic Versioning](https://semver.org/) once it cuts a first tagged release.

## [Unreleased]

### Added

- **HTML reports describe themselves for agents:** a schema.org `Report` JSON-LD block (with `datePublished`, the scanned site and the tool version), a meta description with the score, and Open Graph tags. `formatHtml(report, { canonicalUrl })` adds a canonical link when the publish URL is known; the site's example report uses it, so `/example/` now passes the JSON-LD, freshness and page-readability checks.

### Changed

- **Website** passes its own content checks (13/14 under `--preset content`): crawler policy in `robots.txt` (Content-Signal plus explicit AI-bot groups), `sitemap.xml`, `sitemap.md`, `llms-full.txt`, `AGENTS.md`, an Agent Skill, TDMRep, JSON-LD, canonical links, a Markdown version of each page, and a Worker that serves them for `Accept: text/markdown`. Styles and scripts moved to same-origin files. The install command is now `npm install -g agent-readiness-cli`.

### Fixed

- **`sitemap-lastmod`** passed at 79.5% coverage because it rounded the percentage before comparing; it now passes only at 80% or more, as documented.

## [0.1.0] - 2026-10-15

First public release, published to npm as [`agent-readiness-cli`](https://www.npmjs.com/package/agent-readiness-cli). The command is `agent-readiness` (`agent-readiness-cli` also works, so `npx agent-readiness-cli` and `bunx agent-readiness-cli` run it).

### Added

- **CI/CD examples** ([`docs/ci.md`](docs/ci.md)): a portable gate script (`MIN_SCORE`, `BASELINE`, JSON/HTML/Markdown reports) plus GitHub Actions and GitLab CI workflows. Pull requests are gated on their own build (started in the job, compared with the default branch's scan); a scheduled job watches production. Tested against the fixture servers in `test/ci-examples.test.ts`, and this repo runs the gate on its own site in `.github/workflows/agent-readiness.yml`.
- CLI scanning any URL (public or local) for **39 agent-readiness checks** across 5 categories. See [`docs/checks.md`](docs/checks.md) for endpoints, pass criteria, scoring, and spec links.
  - Discoverability (6): `robots-txt`, `sitemap`, `sitemap-lastmod` (informational), `link-header-api-catalog`, `dns-aid` (informational), `rss-atom` (informational)
  - Content (11): `markdown-negotiation`, `markdown-mirror`, `markdown-link-rel` (informational), `llms-txt` (opt-in), `llms-full-txt` (opt-in), `sitemap-md` (informational), `agents-md` (opt-in), `page-html-quality`, `json-ld`, `freshness-signals` (informational), `semantic-controls` (informational)
  - Bot access control (7): `content-signal`, `ai-bot-rules`, `bot-policy-matrix` (informational), `x-robots-tag`, `tdmrep` (informational), `bot-ua-differential`, `web-bot-auth`
  - Capabilities (12): `a2a-agent-card`, `agent-skills`, `agents-txt` (informational), `api-catalog`, `openapi-discovery`, `oauth-authorization-server`, `oauth-protected-resource`, `mcp-server-card`, `webmcp` (informational), `auth-md` (opt-in), `mcp-server-discover` (opt-in), `browser-agentic` (opt-in)
  - Commerce (3): `ucp`, `x402`, `mpp` (activated by `--commerce-url`)
- **Current protocol coverage**: A2A Agent Card validation, Agent Skills discovery v0.2 with optional digest verification, Content Signals response headers/path scopes/`use`, UCP discovery, x402 v2, MPP, and MCP 2026-07-28 release-candidate discovery.
- **Runtime agent audit**: optional Lighthouse Agentic Browsing integration via `--browser`; remains informational while Chrome marks the category experimental.
- **CI regression gates**: `--baseline <report.json>` exits 1 only for pass→fail transitions and newly introduced failures.
- **Actionable remediation**: every failed or warning check now reports a concise fix, a target-specific one-check verification command, structured JSON guidance, and an optional copy-ready prompt path.
- **Contributor guide**: added `CONTRIBUTING.md` with check acceptance criteria, safety and privacy requirements, remediation guidance, validation commands, and a pull request checklist.
- **Maintenance tooling**: working `audit:specs` script, copy-ready remediation prompts, and a dated [`docs/roadmap.md`](docs/roadmap.md) with ACP/AP2 watch items.
- **Output formats**: `--format human` (default), `json`, `html`, `md`.
  - `html` produces a single self-contained file — inline CSS, no external assets, dark-mode-aware via `prefers-color-scheme`, evidence collapsible per check ([#2](https://github.com/itaides/agent-readiness/pull/2))
  - Redesigned `html` report: 0–100 score ring with grade and verdict, per-category cards, CSS-only status filter, failures sorted first with point gains and a request log per finding, sticky category rail, plain-text "agent" view, optional crawl table, and a **Fix with AI** dialog that builds one prompt for your coding agent from the selected failures. Plain modern CSS (layers, container queries, `light-dark()`), reduced-motion aware, printable.
  - `md` produces a GitHub-flavored report suitable for PR comments and Slack threads ([#2](https://github.com/itaides/agent-readiness/pull/2))
- **JSON report**: each check result now includes `scored`; `score` and `crawl` are accepted when present.
- **Build**: `dist/cli.js` is minified, and the HTML report is a separate chunk loaded only for `--format html`, with its inline CSS and JS minified at build time. CI caps `dist/cli.js` at 100 KB and all of `dist/`'s JavaScript at 150 KB.
- **Website** (`site/`): landing page, example report and a `/scan/` placeholder, built as static assets for Cloudflare Workers. The example report is generated from the real check registry.
- **Aggregate score**: every report carries a 0–100 score and letter grade over scored pass/fail checks, shown in every output format.
- **Crawl sampling**: `--crawl <n>` samples up to n sitemap URLs and aggregates the page-level checks per page.
- **`--version`** prints the version; it and the User-Agent are read from `package.json`.
- **Check selection**: `--preset all|content|api|commerce`, `--only`, `--skip`, `--list-checks`, `--include-llms-txt`, `--include-auth-md`, `--include-agents-md`, `--commerce-url`, `--mcp-url`, and `--browser`.
- **Strict response shape validation** — JSON checks reject SPA-fallthrough responses (`200` + `text/html`) and partial implementations (JSON parses but required fields missing). Catches real production bugs that naive "did we get 200?" scanners miss.
- HTTP client: per-request timeout (5 s default), redirect cap (5 hops), body size cap (5 MB), TLS posture auto-toggled for loopback / RFC 1918 / IPv6 ULA hosts.
- Privacy policy: no telemetry, explicit list of every URL the tool fetches ([`PRIVACY.md`](PRIVACY.md))
- Security policy: vulnerability disclosure + hardening list ([`SECURITY.md`](SECURITY.md))
- GitHub Actions CI on every pull request: type-check, weekly spec-date audit, test, build, and bundle-size gates
- Issue templates: bug report and new-check proposal (the latter requires pass criteria up front)
- One-line installer (`install.sh`) that installs from npm with npm or Bun
- Unit and end-to-end tests under `bun:test`, including protocol shape validation and baseline semantics.
- Minified Node build (`dist/cli.js` ~76 KB, plus the HTML report chunk); Lighthouse is discovered at runtime and is not bundled.

### Fixed

- **Credentials stay on the target origin.** `--cookie` and `--header` values were sent on every request, including redirects off the target and sitemap pages on other hosts. They now go only to the target's origin. `--crawl` also samples only same-origin sitemap pages; before, a sitemap could point the crawl at any host.
- **`mcp-server-card`** check now accepts both MCP card flavors in the wild: the older **v1.json** schema (with top-level `protocolVersion`) and the newer **SEP-1649 / server-card-v1** schema (no `protocolVersion`, richer `auth` + `capabilities` blocks). Previously rejected real working cards on sites using the newer shape (e.g. `matzarich.app`), producing false negatives. ([#3](https://github.com/itaides/agent-readiness/pull/3))

### Known limitations

- **WebMCP fetch-only detection remains heuristic**, so absence is now an informational warning. `--browser` supplies Lighthouse runtime evidence when Chrome 150+ is available.
- **DNS-AID is an Internet-Draft** and the runtime resolver does not expose DNSSEC validation state; the check remains informational and reports DNSSEC as unknown.
- **MCP 2026-07-28 remains a release candidate**; `server/discover` is explicit and informational.
- **ACP and AP2 remain watchlist items** because stable external discovery/pass criteria are not yet clear enough for a non-guessing scanner.
- Installing directly from GitHub (`bun install -g github:itaides/agent-readiness`) doesn't work: `dist/` isn't committed, and Bun doesn't run build scripts for git dependencies. Install from npm, or build from source.

# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project will adopt [Semantic Versioning](https://semver.org/) once it cuts a first tagged release.

## [Unreleased]

### Added

- Bun-based CLI scanning any URL (public or local) for **23 agent-readiness checks** across 5 categories. See [`docs/checks.md`](docs/checks.md) for endpoints, pass criteria, scoring, and spec links.
  - Discoverability (4): `robots-txt`, `sitemap`, `link-header-api-catalog`, `dns-aid` (informational)
  - Content (2): `markdown-negotiation`, `llms-txt` (opt-in)
  - Bot access control (4): `content-signal`, `ai-bot-rules`, `bot-policy-matrix` (informational), `web-bot-auth`
  - Capabilities (10): `a2a-agent-card`, `agent-skills`, `api-catalog`, `oauth-authorization-server`, `oauth-protected-resource`, `mcp-server-card`, `webmcp`, `auth-md`, `mcp-server-discover`, `browser-agentic`
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
- **JSON report**: each check result now includes `scored`; `score` and `crawl` are accepted when present.
- **Website** (`site/`): landing page, example report and a `/scan/` placeholder, built as static assets for Cloudflare Workers. The example report is generated from the real check registry.
  - `md` produces a GitHub-flavored report suitable for PR comments and Slack threads ([#2](https://github.com/itaides/agent-readiness/pull/2))
- **Check selection**: `--preset all|content|api|commerce`, `--only`, `--skip`, `--list-checks`, `--include-llms-txt`, `--include-auth-md`, `--commerce-url`, `--mcp-url`, and `--browser`.
- **Strict response shape validation** — JSON checks reject SPA-fallthrough responses (`200` + `text/html`) and partial implementations (JSON parses but required fields missing). Catches real production bugs that naive "did we get 200?" scanners miss.
- HTTP client: per-request timeout (5 s default), redirect cap (5 hops), body size cap (5 MB), TLS posture auto-toggled for loopback / RFC 1918 / IPv6 ULA hosts.
- Privacy policy: no telemetry, explicit list of every URL the tool fetches ([`PRIVACY.md`](PRIVACY.md))
- Security policy: vulnerability disclosure + hardening list ([`SECURITY.md`](SECURITY.md))
- GitHub Actions CI: type-check, weekly spec-date audit, test, build, 100 KB bundle-size gate
- Issue templates: bug report and new-check proposal (the latter requires pass criteria up front)
- One-line installer (`install.sh`) gated on bun being present
- Unit and end-to-end tests under `bun:test`, including protocol shape validation and baseline semantics.
- Single-file ~81 KB core JS bundle built with `bun build src/cli.ts --target=node`; Lighthouse is discovered at runtime and is not bundled.

### Fixed

- **`mcp-server-card`** check now accepts both MCP card flavors in the wild: the older **v1.json** schema (with top-level `protocolVersion`) and the newer **SEP-1649 / server-card-v1** schema (no `protocolVersion`, richer `auth` + `capabilities` blocks). Previously rejected real working cards on sites using the newer shape (e.g. `matzarich.app`), producing false negatives. ([#3](https://github.com/itaides/agent-readiness/pull/3))

### Known limitations

- **WebMCP fetch-only detection remains heuristic**, so absence is now an informational warning. `--browser` supplies Lighthouse runtime evidence when Chrome 150+ is available.
- **DNS-AID is an Internet-Draft** and the runtime resolver does not expose DNSSEC validation state; the check remains informational and reports DNSSEC as unknown.
- **MCP 2026-07-28 remains a release candidate**; `server/discover` is explicit and informational.
- **ACP and AP2 remain watchlist items** because stable external discovery/pass criteria are not yet clear enough for a non-guessing scanner.
- The published binary install path (`bun install -g github:itaides/agent-readiness`) requires the repo to be public. Currently the repo is private; the working install path is `git clone` + `bun link`.

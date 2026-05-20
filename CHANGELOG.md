# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project will adopt [Semantic Versioning](https://semver.org/) once it cuts a first tagged release.

## [Unreleased]

### Added

- Bun-based CLI scanning any URL (public or local) for **14 agent-readiness checks** across 4 categories. See [`docs/checks.md`](docs/checks.md) for endpoints, pass criteria, and spec links.
  - Discoverability (3): `robots-txt`, `sitemap`, `link-header-api-catalog`
  - Content (2): `markdown-negotiation`, `llms-txt` (opt-in)
  - Bot access control (3): `content-signal`, `ai-bot-rules`, `web-bot-auth`
  - Capabilities (6): `agent-skills`, `api-catalog`, `oauth-authorization-server`, `oauth-protected-resource`, `mcp-server-card`, `webmcp` (heuristic)
- **Output formats**: `--format human` (default), `json`, `html`, `md`.
  - `html` produces a single self-contained file — inline CSS, no external assets, dark-mode-aware via `prefers-color-scheme`, evidence collapsible per check ([#2](https://github.com/itaides/agent-readiness/pull/2))
  - `md` produces a GitHub-flavored report suitable for PR comments and Slack threads ([#2](https://github.com/itaides/agent-readiness/pull/2))
- **Check selection**: `--preset all|content|api`, `--only id1,id2,...`, `--skip id1,id2,...`, `--list-checks`, `--include-llms-txt`
- **Strict response shape validation** — JSON checks reject SPA-fallthrough responses (`200` + `text/html`) and partial implementations (JSON parses but required fields missing). Catches real production bugs that naive "did we get 200?" scanners miss.
- HTTP client: per-request timeout (5 s default), redirect cap (5 hops), body size cap (5 MB), TLS posture auto-toggled for loopback / RFC 1918 / IPv6 ULA hosts.
- Privacy policy: no telemetry, explicit list of every URL the tool fetches ([`PRIVACY.md`](PRIVACY.md))
- Security policy: vulnerability disclosure + hardening list ([`SECURITY.md`](SECURITY.md))
- GitHub Actions CI: type-check, test, build, 100 KB bundle-size gate
- Issue templates: bug report and new-check proposal (the latter requires pass criteria up front)
- One-line installer (`install.sh`) gated on bun being present
- 11 tests (4 robots-txt unit + 5 mcp-server-card unit + 2 e2e against fixture servers) under `bun:test`, ~80 ms full suite
- Single-file ~43 KB JS bundle built with `bun build src/cli.ts --target=node`

### Fixed

- **`mcp-server-card`** check now accepts both MCP card flavors in the wild: the older **v1.json** schema (with top-level `protocolVersion`) and the newer **SEP-1649 / server-card-v1** schema (no `protocolVersion`, richer `auth` + `capabilities` blocks). Previously rejected real working cards on sites using the newer shape (e.g. `matzarich.app`), producing false negatives. ([#3](https://github.com/itaides/agent-readiness/pull/3))

### Known limitations

- **WebMCP** detection is heuristic. The spec genuinely requires JavaScript execution to be fully accurate, and the tool doesn't execute JS. The check tries `/.well-known/webmcp` first, then scans root HTML for `navigator.modelContext`. False negatives are possible; the limitation is named in the check's evidence note.
- **5 checks not yet implemented**: A2A Agent Card, x402, UCP, ACP, MPP. The rule for the queue: no check ships without explicit pass criteria written into [`docs/checks.md`](docs/checks.md) first. Tracked in [#1](https://github.com/itaides/agent-readiness/issues/1).
- The published binary install path (`bun install -g github:itaides/agent-readiness`) requires the repo to be public. Currently the repo is private; the working install path is `git clone` + `bun link`.

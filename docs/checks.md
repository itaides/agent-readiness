# Agent Readiness — Checks Specification

This document is the source of truth for every check the tool performs. Each entry in `src/checks/<id>.ts` implements what is declared here. Reviewers should compare implementation to this spec, not infer behavior from code.

## Target model

The tool's input is a single URL. From it we derive:

- `origin: URL` — scheme + host + port. Origin-scoped checks fetch paths under it.
- `contentUrl: URL` — defaults to the user-supplied URL; can be overridden with `--content-url`. Used only by `markdown-negotiation`.

If the input URL has no path, `contentUrl` falls back (in order) to: the first URL in `sitemap.xml`, then the root URL with `evidence.note: "fallback to root"`.

## Redirect policy

The HTTP client follows up to 5 redirects per request. `evidence.response.finalUrl` records the resolved URL. If any redirect occurred, `evidence.note` is appended with `Followed N redirect(s): <chain>`.

For per-URL checks (Link header on root, markdown-negotiation on contentUrl), evaluation runs against the **final** URL after redirects.

## Locality detection

`Target.isLocal = true` iff the resolved host is in one of:

- 127.0.0.0/8 (IPv4 loopback)
- 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC 1918)
- ::1 (IPv6 loopback)
- fc00::/7 (IPv6 ULA)
- Host literal `localhost`

When `isLocal = true`:

- TLS verification is disabled (equivalent to `--insecure`).
- `commerce`-category checks (future v2) are returned with `status: skip`.
- No other behavioral change.

## Exit codes

| Condition                                          | Exit |
|----------------------------------------------------|------|
| Scan completed, no `--baseline`                    | 0    |
| Scan completed, `--baseline`, no regression        | 0    |
| Scan completed, `--baseline`, at least 1 regression| 1    |
| Network error or invalid target URL                | 2    |
| Internal error (tool bug)                          | 3    |

Exit 1 from failing checks is deliberately *not* used in default mode. The tool reports; CI opts in to gating via `--baseline`.

## Baseline-diff semantics

`--baseline <path>` loads a previous JSON report and compares to the current report.

Definitions:

- **Regression**: a check that was `pass` is now `fail`. Counts toward exit 1.
- **Improvement**: a check that was `fail` is now `pass`. Does not affect exit.
- **New check** (present in current, absent from baseline):
  - Currently `fail` → counts as a regression (the tool got smarter; your site didn't).
  - Currently `pass` → counts as an improvement.
- **Removed check** (present in baseline, absent from current report): dropped from the diff with a stderr warning.
- **Target mismatch** (baseline target URL ≠ current target): hard error, exit 2.
- **Evidence-only change** (same status, different evidence or message): ignored.

## Check contract

Every check is identified by a stable kebab-case `id`. Each check:

1. Receives `Target` and `HttpClient`.
2. Issues one or more HTTP requests.
3. Returns a `CheckResult` with `status` ∈ {`pass`, `fail`, `warn`, `skip`} and evidence describing what was observed.

A check returns `fail` (does not throw) on error. The scanner catches exceptions and converts them to `fail` with `message: "Internal error: …"`.

### Universal F1 defense

Any check that expects a JSON body MUST:

1. Verify HTTP status is 200.
2. Verify response content-type matches `application/json` (or `application/<thing>+json`).
3. Parse the body as JSON; fail on parse error.
4. Validate at least the documented required fields are present.

Failing any of (1)–(4) → `status: fail` with a message naming the specific failure.

This defends against SPA dev servers returning 200 + `text/html` for unknown paths — the dominant local-dev failure mode.

---

## The Checks — v1: 13 scored

Cut from v1, deferred to future work: `x402`, `ucp`, `acp`. The methodologies for detecting these standards from outside are not specified well enough to implement without guessing. Re-add when the specs are stable and the detection endpoints are documented.

### Discoverability

#### `robots-txt`

- **Title**: robots.txt
- **Spec**: https://datatracker.ietf.org/doc/html/rfc9309 (asOf: 2026-04-17)
- **Request**: `GET <origin>/robots.txt`
- **Pass criteria**:
  - HTTP status 200.
  - Content-type starts with `text/plain` (or is empty/missing, which RFC 9309 permits).
  - Body parses successfully with `robots-parser`.
  - Body contains at least one `User-agent:` line.
- **Evidence**: status, content-type, byte count, group count.
- **Caches body** for `content-signal` and `ai-bot-rules` to reuse.

#### `sitemap`

- **Title**: sitemap.xml
- **Spec**: https://www.sitemaps.org/protocol.html (asOf: 2026-04-17)
- **Request**: `GET <origin>/sitemap.xml`. On 404, retry against the first `Sitemap:` directive found in robots.txt (if available).
- **Pass criteria**: 200 + content-type contains `xml` + body opens with `<?xml`, `<urlset`, or `<sitemapindex`.
- **Evidence**: status, content-type, byte count, source (`well-known` or `robots-discovered`).

#### `link-header-api-catalog`

- **Title**: Link header advertising api-catalog (RFC 8288)
- **Spec**: https://datatracker.ietf.org/doc/html/rfc8288 (asOf: 2026-04-17)
- **Request**: `GET <origin>/`
- **Pass criteria**: Response includes a `Link:` header containing `rel="api-catalog"` (case-insensitive).
- **Evidence**: full Link header value, or absence.

### Content

#### `markdown-negotiation`

- **Title**: Markdown content negotiation
- **Spec**: Cloudflare blog (asOf: 2026-04-17)
- **Request**: `GET <contentUrl>` with `Accept: text/markdown`.
- **Pass criteria**:
  - Status 200.
  - Content-type starts with `text/markdown`.
  - Body is non-empty.
  - Body does NOT start with `<!DOCTYPE`, `<html`, or `<HTML` (defends against servers that ignore `Accept` and mislabel content-type).
- **Evidence**: contentUrl used, fallback note (if applicable), content-type, first 256 bytes of body.

#### `llms-txt` (default-off — enable via `--include-llms-txt`)

- **Title**: llms.txt
- **Spec**: https://llmstxt.org/ (asOf: 2026-04-17)
- **Request**: `GET <origin>/llms.txt`
- **Pass criteria**: 200 + content-type `text/plain` or `text/markdown` + body non-empty + body contains at least one `# ` section header.
- **Evidence**: status, content-type, byte count, first H1 line.

### Bot Access Control

#### `content-signal`

- **Title**: Content-Signal directive in robots.txt
- **Spec**: Cloudflare blog (asOf: 2026-04-17)
- **Reuses** the robots.txt body from `robots-txt`.
- **Pass criteria**: At least one line matching `Content-Signal:` (case-insensitive) with at least one recognized signal: `ai-train`, `ai-input`, `search`. Unknown signals are ignored.
- **Evidence**: matched directive lines verbatim.

#### `ai-bot-rules`

- **Title**: AI bot rules in robots.txt
- **Spec**: Cloudflare blog (asOf: 2026-04-17)
- **Reuses** the robots.txt body from `robots-txt`.
- **Pass criteria**: robots.txt contains at least one `User-agent:` line whose value matches one of these (case-insensitive substring match):
  - `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`
  - `ClaudeBot`, `anthropic-ai`
  - `PerplexityBot`, `Perplexity-User`
  - `Google-Extended`
  - `Applebot-Extended`
  - `Bytespider`
  - `Meta-ExternalAgent`
  - `Amazonbot`
  - `CCBot`
  - `cohere-ai`
- **Note**: the check does NOT evaluate allow/disallow stance. The presence of *any* rule for *any* AI bot is a pass — the signal is "you thought about AI bots."
- **Evidence**: which UAs matched.
- **Maintenance**: this list should be reviewed every 6 months. Update both the list and `spec.asOf`.

#### `web-bot-auth`

- **Title**: Web Bot Auth public key directory
- **Spec**: draft-ietf-httpbis-message-signatures (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/http-message-signatures-directory`
- **Pass criteria** (F1-defended):
  - Status 200.
  - Content-type contains `json`.
  - Body parses as JSON.
  - Body has a `keys` array OR is itself a top-level array of key objects (the draft is in flux; accept either shape).
  - At least one entry contains a `kid` or `kty` field (JWK-shaped).
- **Evidence**: shape detected, key count.

### Capabilities

#### `agent-skills`

- **Title**: Agent Skills index
- **Spec**: Cloudflare proposal (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/agent-skills/index.json`
- **Pass criteria** (F1-defended):
  - 200 + JSON content-type + parseable JSON.
  - Body has a `skills` array OR is a top-level array, with at least one entry.
- **Evidence**: skill count, first skill name (if available).

#### `api-catalog`

- **Title**: API Catalog (RFC 9727)
- **Spec**: https://datatracker.ietf.org/doc/html/rfc9727 (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/api-catalog`
- **Pass criteria** (F1-defended):
  - 200 + JSON content-type + parseable JSON.
  - Body matches the RFC 9727 linkset shape: object with a `linkset` array, OR a top-level array of link descriptors.
- **Evidence**: link count.

#### `oauth-authorization-server`

- **Title**: OAuth 2.0 Authorization Server Metadata (RFC 8414)
- **Spec**: https://datatracker.ietf.org/doc/html/rfc8414 (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/oauth-authorization-server`
- **Pass criteria** (F1-defended):
  - 200 + JSON content-type + parseable JSON.
  - Body contains `issuer` (required by RFC 8414).
- **Evidence**: issuer value.

#### `oauth-protected-resource`

- **Title**: OAuth 2.0 Protected Resource Metadata (RFC 9728)
- **Spec**: https://datatracker.ietf.org/doc/html/rfc9728 (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/oauth-protected-resource`
- **Pass criteria** (F1-defended):
  - 200 + JSON content-type + parseable JSON.
  - Body contains `resource` (required by RFC 9728).
- **Evidence**: resource value.

#### `mcp-server-card`

- **Title**: MCP Server Card
- **Spec**: https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json (asOf: 2026-04-17)
- **Request**: `GET <origin>/.well-known/mcp/server-card.json`
- **Pass criteria** (F1-defended):
  - 200 + JSON content-type + parseable JSON.
  - Body contains `protocolVersion`, `serverInfo`, `transport`.
- **Evidence**: server name, protocol version.

#### `webmcp`

- **Title**: WebMCP
- **Spec**: Cloudflare blog and W3C-track proposals (asOf: 2026-04-17). The detection methodology is **not stable**.
- **Caveat (important)**: WebMCP is a runtime browser API — full detection requires executing JavaScript and observing `navigator.modelContext.registerTool()` calls on page load. This check is **fetch-only and heuristic**. A site that loads WebMCP via a separate JS bundle (the common case) will not be detected here. For ground-truth detection use isitagentready.com or a headless-browser scanner.
- **Request**:
  1. `GET <origin>/.well-known/webmcp` (forward-looking — if a future spec settles here).
  2. If that returns non-JSON or non-200, fall back to `GET <origin>/` and scan the response body.
- **Pass criteria**:
  - Pass if step (1) returns 200 + JSON content-type + parseable JSON object.
  - OR pass if step (2) returns 200 and the response body contains the substring `navigator.modelContext`.
  - Otherwise fail.
- **Evidence**: which signal matched (manifest or HTML heuristic) + a note describing the heuristic limitation.

---

## Category totals

Reports show `pass`/`fail`/`total` per category. There is **no** numeric overall score.

| Category         | Scored checks | Default-enabled |
|------------------|--------------:|----------------:|
| discoverability  |             3 |               3 |
| content          |             2 |               1 |
| bot-access       |             3 |               3 |
| capabilities     |             6 |               6 |
| commerce         |             0 |               0 |
| **total**        |        **14** |        **13**   |

`llms-txt` is default-off. `--include-llms-txt` raises the `content` total from 1 to 2.

## HTTP client posture

- Max response body: 5 MB. Excess bytes truncated, check fails with clear message.
- Default User-Agent: `agent-readiness/<version> (+https://github.com/<repo>)`. Overridable with `--user-agent`.
- Per-request timeout: 5000 ms default, configurable with `--timeout`.
- Concurrency: 4 in-flight requests max, configurable with `--concurrency`. Implemented with `p-limit`.
- Cookie injection: `--cookie <string>`. Sent on every request to the target origin.
- Header injection: `--header "K: V"` (repeatable). Sent on every request.
- TLS: strict by default; `--insecure` skips verification; auto-on when `Target.isLocal`.

## Spec staleness audit

`scripts/audit-spec-staleness.ts` runs in CI weekly. Fails if any check's `spec.asOf` is more than 365 days old. Maintainers respond by re-reading the spec, updating the check if the spec changed, and bumping the date.

## Output formats

- `--format human` (default): grouped by category, one line per check with status icon and message.
- `--format json`: the report shape documented below. Stable across patch versions.
- `--format md`: markdown report suitable for PR comments.

### JSON report shape

```json
{
  "version": 1,
  "target": "http://localhost:3000",
  "scannedAt": "2026-05-20T14:23:00Z",
  "tool": { "name": "agent-readiness", "version": "0.0.1" },
  "summary": {
    "discoverability": { "pass": 2, "fail": 1, "total": 3 },
    "content":         { "pass": 1, "fail": 0, "total": 1 },
    "bot-access":      { "pass": 0, "fail": 3, "total": 3 },
    "capabilities":    { "pass": 0, "fail": 5, "total": 5 }
  },
  "checks": [
    {
      "id": "mcp-server-card",
      "category": "capabilities",
      "title": "MCP Server Card",
      "status": "fail",
      "message": "200 but content-type \"text/html\" — likely SPA fallthrough",
      "spec": { "url": "...", "asOf": "2026-04-17" },
      "evidence": { "request": { "method": "GET", "url": "..." }, "response": { "status": 200, "contentType": "text/html", "bytes": 412 } },
      "remediationPromptPath": "prompts/mcp-server-card.md"
    }
  ]
}
```

The top-level `version` field is the report schema version. Bumped only on breaking changes to the JSON shape.

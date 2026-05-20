<h1 align="center">agent-readiness</h1>

<p align="center">
  <a href="https://github.com/itaides/agent-readiness/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/runtime-bun%201.1%2B-black?logo=bun" alt="Bun 1.1+">
  <img src="https://img.shields.io/badge/bundle-37%20KB-brightgreen" alt="37 KB bundle">
  <img src="https://img.shields.io/badge/checks-14-blue" alt="14 checks">
  <img src="https://img.shields.io/badge/telemetry-none-green" alt="Zero telemetry">
  <img src="https://img.shields.io/badge/runtime%20deps-2-lightgrey" alt="2 runtime dependencies">
</p>

<h2 align="center">Is your site ready for AI agents? Find out — without leaving localhost.</h2>

<p align="center"><em>Same checks as isitagentready.com. CLI you can run on staging, intranet, or a PR you haven't merged yet.</em></p>

<p align="center">
<strong>The public agent-readiness tools can't scan code you haven't shipped.</strong>
</p>

<p align="center">
isitagentready.com and Cloudflare's URL Scanner are great — but they only work against URLs that resolve from the public internet. That rules out <code>localhost:3000</code>, your staging deploy behind a VPN, your CI preview environment, and every PR before it merges. Which is exactly when fixing things is cheap.
</p>

<p align="center">
<code>agent-readiness</code> is a single-binary CLI that runs the same 14 checks anywhere — public or local. Plus JSON output for piping, planned <code>--baseline</code> for CI gating, and an F1 defense that rejects SPA fallthroughs the public tools may pass falsely.
</p>

```
$ bunx agent-readiness https://matzarich.app/
agent-readiness  https://matzarich.app/
scanned          2026-05-20T07:31:09.526Z

[discoverability] 3/3 passing
  PASS  robots.txt — Valid robots.txt with 11 User-agent group(s)
  PASS  sitemap.xml — Valid sitemap (well-known)
  PASS  Link header advertising api-catalog — Link header advertises api-catalog

[content] 1/1 passing
  PASS  Markdown content negotiation — Server returns text/markdown for Accept: text/markdown

[bot-access] 2/3 passing
  PASS  Content-Signal directive in robots.txt — Recognized signals: ai-train, search
  PASS  AI bot rules in robots.txt — Rules present for: GPTBot, ClaudeBot, ...
  FAIL  Web Bot Auth public key directory — 200 but content-type "text/html" — likely SPA fallthrough
```

---

## Install

**Requires [bun](https://bun.sh) 1.1+.**

```sh
bun install -g github:itaides/agent-readiness
agent-readiness https://example.com
```

Or run without installing:

```sh
bunx github:itaides/agent-readiness https://example.com
```

To scan a local dev server (HTTPS with self-signed cert? RFC1918? `::1`? — all handled):

```sh
agent-readiness http://localhost:3000
```

---

## What it checks

14 checks across 4 categories. See [`docs/checks.md`](docs/checks.md) for endpoint URLs, pass criteria, and spec references for every check.

### Discoverability (3)
- `robots.txt` ([RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309))
- `sitemap.xml` (with `robots.txt` fallback discovery)
- `Link` header advertising `rel="api-catalog"` ([RFC 8288](https://datatracker.ietf.org/doc/html/rfc8288))

### Content (2)
- Markdown content negotiation (`Accept: text/markdown`)
- `llms.txt` ([llmstxt.org](https://llmstxt.org/) — opt-in via `--include-llms-txt`)

### Bot access control (3)
- `Content-Signal:` directive in `robots.txt` (`ai-train`, `ai-input`, `search`)
- AI bot rules in `robots.txt` (matches against 14 known bots: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.)
- Web Bot Auth key directory at `/.well-known/http-message-signatures-directory`

### Capabilities (6)
- Agent Skills index at `/.well-known/agent-skills/index.json`
- API Catalog at `/.well-known/api-catalog` ([RFC 9727](https://datatracker.ietf.org/doc/html/rfc9727))
- OAuth Authorization Server Metadata ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414))
- OAuth Protected Resource Metadata ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728))
- MCP Server Card at `/.well-known/mcp/server-card.json`
- WebMCP (heuristic — fetch-only model can't fully detect a runtime JS API; documented as such)

### Not yet (see [issue #1](https://github.com/itaides/agent-readiness/issues/1))
- A2A Agent Card, x402, UCP, ACP, MPP — specs being researched before any check is shipped.

---

## CLI

```
agent-readiness <url> [options]

  --preset all|content|api      Check group preset (default: all)
  --only id1,id2,...            Run only these check IDs (overrides --preset)
  --skip id1,id2,...            Skip these check IDs (applied after preset)
  --list-checks                 List all available checks and presets, then exit
  --include-llms-txt            Run the opt-in llms.txt check
  --format human|json           Output format (default: human)
  --timeout <ms>                Per-request timeout (default: 5000)
  --concurrency <n>             Parallel requests (default: 4)
  --insecure                    Skip TLS verification (auto-on for loopback/RFC1918)
  --user-agent <ua>             Spoof UA (e.g. "GPTBot/1.0")
  --header "K: V"               Inject a request header (repeatable)
```

JSON output is pipeable and diffable:

```sh
agent-readiness https://example.com --format json | jq '.summary'
```

---

## What makes this different

### Localhost works
Every check is implemented from HTTP-level signals only — no headless browser, no JS execution required (except for WebMCP, where the spec genuinely requires JS and we say so explicitly). That means it runs against any URL you can reach from your machine, including `http://localhost:3000`, `https://staging.internal.corp/`, and `http://[::1]:8080/`.

### F1 defense catches real bugs
SPA dev servers return `200 OK` + `text/html` for any path, including `/.well-known/*` paths that should be JSON. A naive scanner ("did we get 200?") would falsely report these as passing. Every JSON check in `agent-readiness` validates content-type **and** parses the body **and** checks required fields before claiming a pass.

**Real example**: scanning `matzarich.app` revealed that `/.well-known/http-message-signatures-directory` returns HTTP 200 + `text/html` (SPA fallthrough). An agent hitting that endpoint expecting JWK keys gets HTML back and silently fails. Our F1 defense flags this; we suspect the web tool does not.

### CI-friendly
JSON output and pipeable exit codes mean you can wire it into PR pipelines. `--baseline` flag (planned) will exit non-zero only when a check regresses — so the first run never breaks CI, but the next push that introduces a regression does.

### Honest about heuristics
The WebMCP check requires JavaScript execution to be fully accurate. We don't do JS; we do a heuristic (well-known manifest first, then HTML substring scan). The check definition in `docs/checks.md` says so. No fake green ticks.

---

## Real-world scores (2026-05-20)

| Site | Score | Notes |
|---|---|---|
| matzarich.app | 10/13 | Excellent — beats `developers.cloudflare.com` on most checks |
| developers.cloudflare.com | 6/13 | The blog's showcase site; missing OAuth + MCP card schema bug |
| cloudflare.com | 6/13 | Strong on bot rules, weak on capabilities |
| eventimio.ai | 3/13 | Strong on Content-Signal, gaps everywhere else |

Bugs found in production deployments during smoke testing:
- `matzarich.app` Web Bot Auth endpoint returns SPA HTML instead of JWK directory
- `matzarich.app` MCP Server Card missing required `protocolVersion` field
- `developers.cloudflare.com` MCP Server Card missing all three required fields

These are exactly the failures the F1 defense is designed to surface.

---

## Privacy

The tool makes HTTP requests **only** to the target URL you provide. No analytics, no telemetry, no phone-home, no third-party services. See [`PRIVACY.md`](PRIVACY.md).

The code in this repository is the code that runs on your machine. The build artifact (`dist/cli.js`) is a single ~37 KB bundle with two runtime dependencies (`p-limit`, `robots-parser`) — both inlined.

---

## Security

Reporting a vulnerability: see [`SECURITY.md`](SECURITY.md). Public disclosure of agent-readiness bugs in *target sites* you scan is your call — but please report tool bugs (e.g. an F1 false positive) privately first.

---

## Develop

```sh
git clone https://github.com/itaides/agent-readiness.git
cd agent-readiness
bun install
bun test            # 6 tests, ~60 ms
bun run build       # dist/cli.js — single ~37 KB bundle
bunx tsc --noEmit -p .
```

Project layout:

```
src/
  cli.ts             # arg parsing + main()
  scanner.ts         # parallel check orchestrator
  http.ts            # fetch wrapper: timeout, redirects, body cap, insecure mode
  target.ts          # URL normalize + locality detection (loopback / RFC1918 / ULA)
  report.ts          # human + JSON formatters
  registry.ts        # check list + preset definitions
  types.ts           # Check, CheckResult, Target, HttpClient, Report
  checks/
    _shared.ts       # JSON well-known fetcher (F1 defense) + makeResult helper
    *.ts             # one file per check (14 of them)
test/
  checks/*.test.ts   # per-check unit tests
  e2e.test.ts        # all checks against fixture-server
testdata/
  fixture-server.ts  # all-pass + SPA-fallthrough modes
docs/
  checks.md          # spec — pass criteria for every check
```

Adding a new check:
1. Add `src/checks/<id>.ts` with a default export of type `Check`.
2. Register it in `src/registry.ts`.
3. Document it in `docs/checks.md` with endpoint + pass criteria + spec URL + `asOf` date.
4. Add fixture data to `testdata/fixture-server.ts` for the all-pass case.
5. `bun test` should still pass.

---

## License

[MIT](LICENSE). Inspired by [isitagentready.com](https://isitagentready.com) and the [Cloudflare agent-readiness blog post](https://blog.cloudflare.com/agent-readiness/). Independent open-source implementation — not affiliated with Cloudflare.

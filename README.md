# agent-readiness

A CLI that checks whether a website is ready for AI agents — works on public URLs and on local development servers (`http://localhost:3000`, internal IPs, self-signed TLS).

Designed to be run in CI alongside your linter, so agent-readiness regressions show up in PRs before they ship.

## Quick start

```sh
bunx agent-readiness https://example.com
bunx agent-readiness http://localhost:3000
```

## What it checks

13 checks across 4 categories:

- **Discoverability** — robots.txt, sitemap.xml, RFC 8288 Link header for api-catalog
- **Content** — Markdown content negotiation, `llms.txt` (opt-in)
- **Bot Access Control** — Content-Signal directive, AI bot rules, Web Bot Auth keys
- **Capabilities** — Agent Skills, API Catalog (RFC 9727), OAuth metadata (RFC 8414 + 9728), MCP Server Card

See [docs/checks.md](docs/checks.md) for the full spec, including pass criteria and request shapes.

## CI integration

Use `--baseline` to fail the build only when agent-readiness regresses (no flag = report-only):

```sh
bunx agent-readiness https://example.com --format json --output current.json
bunx agent-readiness https://example.com --baseline previous.json
```

Exit codes are documented in [docs/checks.md](docs/checks.md).

## Common flags

```
--preset all|content|api  Which check group to run (default: all)
--only id1,id2,...        Run only these check IDs (overrides --preset)
--skip id1,id2,...        Skip these check IDs (applied after --preset)
--list-checks             List every available check + presets, then exit
--include-llms-txt        Run the opt-in llms.txt check
--header "K: V"           Inject a request header (repeatable)
--user-agent <ua>         Spoof UA (e.g. "GPTBot/1.0")
--insecure                Skip TLS verification (auto-on for loopback/RFC1918)
--concurrency <n>         Parallel requests (default: 4)
--timeout <ms>            Per-request timeout (default: 5000)
--format human|json       Output (default: human)
--help, -h                Show full usage
```

## Privacy

The tool issues HTTP requests only to the target URL you provide. No telemetry. No analytics. The code in this repository is what runs on your machine.

## Inspired by

[isitagentready.com](https://isitagentready.com) and [Cloudflare's agent readiness blog post](https://blog.cloudflare.com/agent-readiness/). This is an independent open-source implementation; it is not affiliated with Cloudflare.

## License

MIT

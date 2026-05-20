# Privacy

`agent-readiness` is a local-first CLI. It collects no data, reports no usage, and contacts no third-party services.

## What network traffic the tool makes

When you run `agent-readiness <url>`, the tool issues HTTP requests **only** to the URL you provide and (depending on which checks are enabled) standard paths beneath that origin:

- `<origin>/robots.txt`
- `<origin>/sitemap.xml`
- `<origin>/llms.txt` (only if `--include-llms-txt` is passed)
- `<origin>/.well-known/agent-skills/index.json`
- `<origin>/.well-known/api-catalog`
- `<origin>/.well-known/oauth-authorization-server`
- `<origin>/.well-known/oauth-protected-resource`
- `<origin>/.well-known/mcp/server-card.json`
- `<origin>/.well-known/http-message-signatures-directory`
- `<origin>/.well-known/webmcp`
- `<origin>/` (root, for Link header and WebMCP heuristic)
- `<contentUrl>` (for Markdown content negotiation; defaults to your input URL)

If a redirect is encountered, the tool follows up to 5 hops within the same protocol/host policy.

## What network traffic the tool does NOT make

- No analytics or telemetry endpoint.
- No update check ("phone home").
- No third-party CDN for assets at runtime.
- No DNS resolution of anything you did not ask the tool to scan.

## Data storage

The tool does not write any files unless you pass `--output`. There is no cache, no history, no persistent state on disk. Every invocation is stateless.

## Verifying

The code in this repository is the code that runs on your machine. The published binary is a single bundled file produced by `bun build src/cli.ts` — you can rebuild it yourself and compare:

```sh
bun install
bun run build
shasum -a 256 dist/cli.js
```

There is no minified, obfuscated, or remotely-loaded code path.

## Out of scope

- The websites you scan may log your request. That is between you and the target site. `agent-readiness` sends a documented User-Agent string by default (`agent-readiness/<version> (+https://github.com/itaides/agent-readiness)`) so target operators can identify it.
- If you set `--user-agent <ua>` to spoof another bot (e.g. `GPTBot/1.0`), you take responsibility for any logging or filtering that may follow.

## Questions

Open an issue at https://github.com/itaides/agent-readiness/issues.

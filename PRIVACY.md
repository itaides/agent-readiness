# Privacy

`agent-readiness` is a local-first CLI. It collects no analytics, sends no telemetry, performs no update check, and has no service account.

## Default network traffic

The default scan contacts the supplied origin and standard paths below it:

- `/`, `/robots.txt`, and `/sitemap.xml`;
- `/.well-known/agent-card.json`;
- `/.well-known/agent-skills/index.json`;
- `/.well-known/api-catalog`;
- `/.well-known/oauth-authorization-server`;
- `/.well-known/oauth-protected-resource`;
- `/.well-known/mcp/server-card.json`;
- `/.well-known/http-message-signatures-directory`;
- `/.well-known/webmcp`;
- the input URL or explicit `--content-url` for Markdown negotiation and response-header checks.

It also asks the operating system's configured DNS resolver for `_index._agents.<target-host>` unless the target is local/private. Redirects are followed up to five hops. A sitemap URL advertised by the target may point to another origin. `--crawl <n>` samples only sitemap pages on the target's own origin.

## Explicit network expansion

These flags deliberately broaden the scan:

- `--include-llms-txt` requests `/llms.txt`.
- `--include-auth-md` requests `/auth.md`.
- `--verify-skill-digests` fetches HTTP(S) artifact URLs advertised by the target's Agent Skills index; those URLs may be on other origins.
- `--mcp-url` sends one read-only `server/discover` request to that URL.
- `--commerce-url` requests the supplied paid resource and `/.well-known/ucp` on that resource's origin. It does not send money, credentials, or a payment retry.
- `--browser` launches local Lighthouse/Chrome against the content URL. The page may load any subresources, analytics, or third-party scripts it normally loads in a browser.

The tool never calls Cloudflare, WorkOS, Chrome, x402, UCP, MPP, or MCP services merely because their specifications are checked.

## Headers and credentials

`--header`, `--cookie`, and `--user-agent` are explicit user controls. Headers from `--header` and `--cookie` are sent only to the target's origin: requests to other origins, including redirects off the target and URLs the target advertises (sitemaps, skill artifacts), go without them, and so do `--mcp-url` and `--commerce-url` requests to other origins. `--user-agent` applies to every request. Browser mode does not copy CLI headers or cookies into Chrome.

## Data storage

The CLI does not maintain a cache, history, or telemetry state. JSON/HTML/Markdown reports are written only when you redirect stdout. `--baseline` reads the file you name. Lighthouse output is captured in memory and is not persisted by this tool.

## Verifying

The published CLI is built from this repository:

```sh
bun install
bun run build
shasum -a 256 dist/cli.js
```

## Target logging

Targets and their dependencies may log scan traffic. The default User-Agent identifies the tool. If you spoof another agent or provide credentials, you are responsible for the resulting access and logs.

Questions and corrections are welcome at https://github.com/itaides/agent-readiness/issues.

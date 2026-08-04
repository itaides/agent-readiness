# Security Policy

## Reporting a vulnerability in agent-readiness

If you find a security issue in the tool itself — for example, a way to crash the CLI with crafted server responses, an SSRF surface exposed by an unintended code path, or a false-positive that lets a non-agent-ready site report as agent-ready — please report it privately first.

**Preferred channel**: GitHub Security Advisories on this repo (https://github.com/itaides/agent-readiness/security/advisories/new).

**Fallback**: open a public issue with the prefix `[security]` if private disclosure is not feasible.

We aim to acknowledge reports within 72 hours and ship a fix or mitigation within 14 days for high-severity issues.

## Out of scope

Findings about *target websites* you scan are not vulnerabilities in this tool — they are findings about those sites. Disclose those to the affected site operators directly.

## Hardening already in place

- HTTP body size cap (5 MB default) prevents OOM from large/malicious responses.
- Per-request timeout (5 s default) prevents hung scans.
- Redirect cap (5 hops) prevents redirect-chain DoS.
- Strict response shape validation (content-type + JSON parse + required-field check) prevents false positives from SPA-fallthrough servers.
- `--insecure` is automatically enabled only for loopback/RFC1918/ULA hosts and explicit user opt-in. Public hosts get strict TLS verification.
- Commerce checks observe only the initial challenge, never pay, and skip local/private targets.
- MCP discovery invokes only `server/discover`; it never calls a tool, prompt, or resource.
- Agent Skills artifact fetching is explicit through `--verify-skill-digests` and checks the advertised SHA-256 digest.
- Browser execution is explicit through `--browser` and uses the locally installed Lighthouse/Chrome binaries.
- No `eval` and no remotely loaded executable code.

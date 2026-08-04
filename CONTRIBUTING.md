# Contributing to agent-readiness

Thanks for helping make agent-readiness more accurate, actionable, and safe. Contributions are welcome for checks, protocol research, fixtures, reporting, documentation, and bug fixes.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use the bug report template for incorrect results or runtime failures.
- Use the new-check template when proposing protocol coverage.
- Report vulnerabilities in the CLI privately according to [SECURITY.md](SECURITY.md).

Findings about a scanned website are not vulnerabilities in this project. Share them with the website operator instead.

## Development setup

Requirements:

- Bun 1.1 or newer
- Node.js for the built CLI
- Lighthouse 13.3+ and Chrome 150+ only when working on `--browser`

```sh
git clone git@github.com:itaides/agent-readiness.git
cd agent-readiness
bun install
bun run typecheck
bun test
bun run build
```

Run the development CLI through Bun:

```sh
bun run src/cli.ts https://example.com
```

Or test the bundled artifact:

```sh
bun run build
node dist/cli.js https://example.com
```

## Contribution workflow

1. Create a focused branch from `main`.
2. Keep unrelated changes out of the branch.
3. Add or update tests with the implementation.
4. Update documentation and `CHANGELOG.md` when behavior changes.
5. Run the complete validation suite.
6. Open a pull request explaining the behavior, safety boundaries, and verification performed.

## Adding or changing a check

A check must have externally observable, deterministic pass criteria before it ships. If a proposal cannot yet distinguish a valid implementation from an absent or partial one, keep it in `docs/roadmap.md` until the protocol stabilizes.

For a new check:

1. Define the endpoint, method, headers, required response shape, and precise pass criteria in `docs/checks.md`.
2. Link an authoritative specification, RFC, draft, or first-party protocol document. Blog posts may provide ecosystem context but should not be the sole source of pass criteria.
3. Add `src/checks/<id>.ts` and register it in `src/registry.ts`.
4. Decide whether the check is scored, informational, default-enabled, or opt-in.
5. Add concise guidance to `src/remediation.ts` for failed and warning results.
6. Add a copy-ready `prompts/<id>.md` implementation prompt when the remediation needs more than a short suggestion.
7. Extend `testdata/fixture-server.ts` and add focused tests for valid, absent, malformed, and SPA-fallthrough responses where applicable.
8. Verify the check directly:

```sh
node dist/cli.js https://example.com --only <check-id>
```

Every check must record `spec.url` and `spec.asOf`. The weekly audit rejects missing or stale review metadata.

### Scoring guidance

- Score stable checks with unambiguous externally detectable requirements.
- Keep drafts, experimental browser APIs, and incomplete fetch-only heuristics informational.
- A `200` response is never sufficient for structured endpoints: validate content type, parse the body, and check required fields.
- Do not score whether a site chooses to allow or deny a bot or content use. Score whether its policy is valid and explicit.

### Safety and privacy requirements

Checks must remain read-only and narrowly scoped:

- Default checks contact only the target origin and its DNS resolver.
- New external destinations require explicit user activation and documentation in `PRIVACY.md`.
- Commerce checks may inspect the initial challenge but must never pay, retry with credentials, or submit authorization.
- MCP checks must not invoke tools, prompts, or resources.
- Artifact fetching must be opt-in, size-limited, and integrity-checked.
- Browser execution must remain explicit.
- Preserve request timeouts, redirect limits, response-size caps, and strict public TLS verification.
- Never include secrets, private endpoint contents, cookies, or authorization headers in evidence or fixtures.

## Remediation guidance

Failed and warning checks should tell users what to do next without overclaiming that every optional protocol applies to every site.

- Use conditional language for optional capabilities such as A2A, MCP, OAuth, Web Bot Auth, and commerce.
- Preserve the site owner's policy choices.
- Provide a command that reruns only the affected check.
- Keep human output concise; put longer implementation instructions in `prompts/`.
- Ensure human, JSON, Markdown, and HTML reports remain consistent.

## Tests and validation

Run all required checks before opening a pull request:

```sh
bun run typecheck
bun run audit:specs
bun run build
bun test
node dist/cli.js --list-checks
git diff --check
```

The bundled `dist/cli.js` must remain below the CI limit of 100 KB. If your work needs a large or platform-specific dependency, prefer explicit runtime discovery like the Lighthouse integration.

Tests should use local deterministic fixtures rather than depending on public websites. A live read-only scan may supplement fixture coverage, but it should not be the only verification.

## Pull request checklist

- [ ] The change is focused and documented.
- [ ] New or changed pass criteria are recorded in `docs/checks.md`.
- [ ] Authoritative spec metadata is current.
- [ ] Remediation guidance is included where applicable.
- [ ] Safety, privacy, and opt-in boundaries are preserved.
- [ ] Tests cover success and realistic failure shapes.
- [ ] `CHANGELOG.md` is updated for user-visible behavior.
- [ ] The complete validation suite passes.

By submitting a contribution, you agree that it may be distributed under the repository's [MIT License](LICENSE).

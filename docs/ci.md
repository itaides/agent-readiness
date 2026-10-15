# Running agent-readiness in CI/CD

Scan a URL on every pull request, keep the reports as build artifacts, and fail the build when agent readiness gets worse.

The examples below are copy-paste ready and **tested**: `test/ci-examples.test.ts` runs the gate script against local fixture servers on every CI run of this repo.

| File | What it is |
|---|---|
| [`examples/ci/agent-readiness-gate.sh`](../examples/ci/agent-readiness-gate.sh) | Portable gate script. Works in any CI that has Node 20+ and bash |
| [`examples/ci/github-actions.yml`](../examples/ci/github-actions.yml) | GitHub Actions workflow: PR gate, reports, job summary, baseline from `main` |
| [`examples/ci/gitlab-ci.yml`](../examples/ci/gitlab-ci.yml) | GitLab CI job: merge request gate, reports, baseline from the default branch |

## Pick a gate

The CLI on its own exits `0` even when checks fail, so a plain scan never breaks a build. You choose what should:

| Your URL | Gate | How |
|---|---|---|
| Stable (staging, production) | **No new failures**: existing failures are allowed, anything that newly fails breaks the build | `BASELINE=path/to/report.json`, a previous JSON report for the same URL |
| Changes per PR (preview deploys) | **Minimum score**: the 0–100 score must not drop below a floor | `MIN_SCORE=70` |
| Anything | **Report only**: never fail, just keep the reports | Neither |

Both gates can run together. `--baseline` requires the baseline to have been scanned against the **same URL**; a different URL is a usage error (exit 2), not a regression. That's why per-PR preview URLs use `MIN_SCORE`.

### Exit codes

| CLI | Gate script | Meaning |
|---|---|---|
| `0` | `0` | Scan finished; no gate failed |
| `1` | `1` | `--baseline` found a pass → fail (or new fail) regression. The script also returns `1` when the score is below `MIN_SCORE` |
| `2` | `2` | Usage error, bad URL, unreadable or mismatched baseline, or network failure |
| `3` | `2` | Internal error in the tool. Please [report it](https://github.com/itaides/agent-readiness/issues) |

## The gate script

```sh
MIN_SCORE=70 BASELINE=.agent-readiness/baseline.json \
  bash scripts/agent-readiness-gate.sh https://staging.example.com
```

It runs the CLI with `npx --yes agent-readiness-cli@0.1.0` (pinned, so a new release can't change your gate unannounced) and writes three files to `OUT_DIR` (default `agent-readiness-report/`):

- `report.json`: the gating scan, and the next baseline
- `report.html`: self-contained report for a build artifact
- `report.md`: for job summaries and PR comments

| Variable | Default | Purpose |
|---|---|---|
| `MIN_SCORE` | unset | Fail when the score is below this |
| `BASELINE` | unset | Previous `report.json` for the same URL. A missing file skips the regression check with a warning, so the first run on a new repo still passes |
| `OUT_DIR` | `agent-readiness-report` | Where the reports go |
| `SCAN_ARGS` | unset | Extra CLI flags, split on spaces, e.g. `--crawl 10` or `--preset content` |
| `SCAN_HEADER` | unset | One request header for a protected target, from a secret |
| `SCAN_COOKIE` | unset | Cookie value for a protected target, from a secret |
| `AGENT_READINESS` | `npx --yes agent-readiness-cli@0.1.0` | Command that runs the CLI |

The HTML and Markdown reports come from separate scans after the gating JSON scan. A flaky endpoint can therefore differ between files; the JSON report is the one the gate used.

## GitHub Actions

1. Copy [`examples/ci/github-actions.yml`](../examples/ci/github-actions.yml) to `.github/workflows/agent-readiness.yml`.
2. Copy the gate script to `scripts/agent-readiness-gate.sh`.
3. Set the repository variable `AGENT_READINESS_URL` (Settings → Secrets and variables → Actions → Variables).

On pushes to `main`, the workflow scans and saves `report.json` to the Actions cache as the baseline. On pull requests it restores the newest baseline from `main`, gates on regressions and `MIN_SCORE`, uploads the three reports as an artifact, and writes the Markdown report to the job summary.

### Preview deployments

For Vercel, Netlify, Cloudflare and other providers that report GitHub deployments, scan the preview URL once it's live. The URL changes per PR, so gate on the score:

```yaml
on:
  deployment_status:

jobs:
  agent-readiness:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Scan preview
        run: bash scripts/agent-readiness-gate.sh "$PREVIEW_URL"
        env:
          # Through env, not ${{ }} in the script, so the URL can't inject shell.
          PREVIEW_URL: ${{ github.event.deployment_status.environment_url }}
          MIN_SCORE: '70'
```

### Scan the app inside the job

No deployment needed: start the app on the runner and scan `localhost`. The CLI handles local HTTP and self-signed HTTPS. DNS-AID and commerce checks skip local targets.

```yaml
      - run: npm ci && npm run build
      - name: Start the app
        run: |
          npm start &
          for i in $(seq 60); do curl -fs http://localhost:3000 > /dev/null && break; sleep 1; done
      - name: Scan
        run: bash scripts/agent-readiness-gate.sh http://localhost:3000
        env:
          MIN_SCORE: '60'
```

## GitLab CI

1. Add the job from [`examples/ci/gitlab-ci.yml`](../examples/ci/gitlab-ci.yml) to `.gitlab-ci.yml`.
2. Copy the gate script to `scripts/agent-readiness-gate.sh`.
3. Set the CI/CD variable `AGENT_READINESS_URL`.

The job runs on merge requests and on the default branch. One cache key holds the baseline: merge requests only read it (`policy: pull`), and the default branch reads and writes it (`pull-push`, chosen with `rules:variables`). Reports are exposed on the merge request through `artifacts:expose_as`.

## Other CI systems

Any runner with Node 20+ and bash works. Run the script and keep `agent-readiness-report/` as an artifact:

```sh
bash scripts/agent-readiness-gate.sh "$AGENT_READINESS_URL"
```

Without the script, call the CLI directly and gate with `--baseline`:

```sh
npx --yes agent-readiness-cli@0.1.0 "$URL" --baseline baseline.json --format json > report.json
```

## Tips

- **Scan more than the homepage:** `SCAN_ARGS="--crawl 10"` samples 10 sitemap pages and adds the crawl table to the report.
- **Gate on part of the suite:** `SCAN_ARGS="--preset content"` or `--only robots-txt,sitemap,llms-txt`. Keep the same selection for the baseline run.
- **Staging behind auth:** set `SCAN_HEADER` (e.g. `Authorization: Bearer <token>`) or `SCAN_COOKIE` from a CI secret. They're separate from `SCAN_ARGS` because header values contain spaces, and the CLI only sends them to the target's origin.
- **Slow targets:** add `--timeout 15000` (milliseconds per request) to `SCAN_ARGS`.
- **Upgrading:** bump the pinned version in the script, then refresh the baseline on `main`. New checks only count as regressions if they fail, and checks missing from the new scan are reported as warnings.

## How these examples are tested

`test/ci-examples.test.ts` runs `examples/ci/agent-readiness-gate.sh` against the fixture servers in `testdata/`, with this checkout's CLI in place of the npm package. It covers:

- a passing site writes all three reports and exits `0`
- a score below `MIN_SCORE` exits `1` and still writes the reports
- an existing failure in the baseline doesn't fail the build, but a pass → fail regression exits `1`
- a missing baseline file skips the regression check
- a bad URL exits `2`
- `SCAN_ARGS` reaches the CLI

It also checks that both workflow files are valid YAML, call the script, and that the script's pinned version matches `package.json`.

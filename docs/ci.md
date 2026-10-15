# Running agent-readiness in CI/CD

Scan every pull request's own build, keep the reports as build artifacts, fail the build when agent readiness gets worse, and watch production for changes made outside the repo.

The examples below are copy-paste ready and **tested**: `test/ci-examples.test.ts` runs the gate script against local fixture servers on every CI run of this repo.

| File | What it is |
|---|---|
| [`examples/ci/agent-readiness-gate.sh`](../examples/ci/agent-readiness-gate.sh) | Portable gate script. Works in any CI that has Node 20+ and bash |
| [`examples/ci/github-actions.yml`](../examples/ci/github-actions.yml) | GitHub Actions workflow: gate each PR on its own build against `main`'s baseline, plus a daily production scan |
| [`examples/ci/gitlab-ci.yml`](../examples/ci/gitlab-ci.yml) | GitLab CI jobs: the same, for merge requests and pipeline schedules |

## Pick a gate

The CLI on its own exits `0` even when checks fail, so a plain scan never breaks a build. You choose what should, and **what you scan matters as much as the gate**:

- **Gate pull requests on their own code.** Build and start the app in the CI job and scan `localhost`, or scan the PR's preview deployment. Scanning a fixed staging or production URL from a PR measures what's already deployed, not the PR: a production problem would fail every open PR, and a PR that breaks `robots.txt` would pass.
- **Watch production separately.** A scheduled job scans the deployed site and catches changes made outside the repo, such as CDN, WAF or hosting settings.

| What you scan | Gate | How |
|---|---|---|
| The app started in the CI job (`localhost`) | **No new failures** against the default branch's last scan, plus a **minimum score** | `BASELINE` and `MIN_SCORE`. The URL is the same on every run, so the default branch's report is a valid baseline |
| A per-PR preview deployment | **Minimum score**: the 0–100 score must not drop below a floor | `MIN_SCORE=70`. The URL changes per PR, so there's no baseline |
| Production, on a schedule | **No new failures** against the last passing scan | `BASELINE`, saved only when the scan passes, so a regression keeps failing until it's fixed |
| Anything | **Report only**: never fail, just keep the reports | Neither |

Both gates can run together. `--baseline` requires the baseline to have been scanned against the **same URL**; a different URL is a usage error (exit 2), not a regression.

### Exit codes

| CLI | Gate script | Meaning |
|---|---|---|
| `0` | `0` | Scan finished; no gate failed |
| `1` | `1` | `--baseline` found a pass → fail (or new fail) regression. The script also returns `1` when the score is below `MIN_SCORE` |
| `2` | `2` | Usage error: missing or bad URL, `MIN_SCORE` that isn't a whole number, unreadable or mismatched baseline, or a network failure. A misconfigured job never looks like a readiness regression |
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
3. Adjust `APP_URL`, `BUILD_CMD` and `START_CMD` in the `build` job to how your app builds and starts.
4. Optional: set the repository variable `AGENT_READINESS_URL` (Settings → Secrets and variables → Actions → Variables) to turn on the daily production scan.

The workflow has two jobs:

- **`build`** runs on pull requests and pushes to `main`. It builds and starts the app on the runner and scans `APP_URL`. On `main` it saves the scan to the Actions cache as the baseline. On a pull request it restores the newest baseline from `main`, so anything the PR newly breaks fails the build, and the score must stay at `MIN_SCORE` or above. Reports are uploaded as an artifact and the Markdown report goes to the job summary.
- **`production`** runs daily and on demand when `AGENT_READINESS_URL` is set. It compares the deployed site with its last passing scan and only saves a new baseline when it passes.

This repository runs the same setup on its own site in [`.github/workflows/agent-readiness.yml`](../.github/workflows/agent-readiness.yml): it builds `site/`, serves it with `wrangler dev`, and calls the example gate script unchanged.

### Preview deployments

If your host deploys a preview for every PR (Vercel, Netlify, Cloudflare and others report GitHub deployments), you can scan the preview instead of starting the app. The URL changes per PR, so gate on the score:

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

## GitLab CI

1. Add the jobs from [`examples/ci/gitlab-ci.yml`](../examples/ci/gitlab-ci.yml) to `.gitlab-ci.yml`.
2. Copy the gate script to `scripts/agent-readiness-gate.sh`.
3. Adjust `APP_URL` and the build and start commands in the `agent-readiness` job.
4. Optional: for production, create a pipeline schedule and set the CI/CD variable `AGENT_READINESS_URL`.

`agent-readiness` runs on merge requests and on pushes to the default branch. It builds and starts the app in the job and scans `APP_URL`. One cache key holds the baseline: merge requests only read it (`policy: pull`), and the default branch reads and writes it (`pull-push`, chosen with `rules:variables`). Reports are exposed on the merge request through `artifacts:expose_as`.

`agent-readiness:production` runs in scheduled pipelines when `AGENT_READINESS_URL` is set, with its own cache, and saves a new baseline only when the scan passes.

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
- **Content sites:** `SCAN_ARGS="--site-type content"` (from 0.2.0) skips the API and auth checks a docs or marketing site can't have and leaves them out of the score, so `MIN_SCORE` measures what applies.
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
- a bad URL, a missing URL, and a `MIN_SCORE` that isn't a whole number exit `2`
- `SCAN_ARGS` reaches the CLI

It also checks that both workflow files are valid YAML and have the `build` and `production` jobs, that the `build` job scans the app it started rather than `AGENT_READINESS_URL`, and that the script's pinned version matches `package.json`.

This repository's own [`.github/workflows/agent-readiness.yml`](../.github/workflows/agent-readiness.yml) runs the gate script for real on every pull request and push to `main`, against the site in `site/`.

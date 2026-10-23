#!/usr/bin/env bash
# Portable CI gate for agent-readiness. Copy into your repo (e.g. scripts/) and call it from any CI.
#
#   agent-readiness-gate.sh <url>
#
# Environment (all optional):
#   MIN_SCORE        Fail when the 0-100 score is below this number.
#   BASELINE         Path to a previous report.json for the SAME url. Fail only on pass -> fail regressions.
#   OUT_DIR          Where report.json, report.html and report.md go (default: agent-readiness-report).
#   SCAN_ARGS        Extra CLI flags, split on spaces, e.g. "--crawl 10 --preset content".
#   SCAN_HEADER      One request header for a protected target, e.g. "Authorization: Bearer $TOKEN" (from a secret).
#   SCAN_COOKIE      Cookie header value for a protected target (from a secret).
#   AGENT_READINESS  Command that runs the CLI (default: npx --yes agent-readiness-cli@0.4.0).
#
# Exit codes: 0 pass, 1 gate failed (score below MIN_SCORE or baseline regression), 2 scan/usage error.
set -uo pipefail

# Configuration mistakes exit 2, like scan errors, so they never look like a readiness regression.
usage_error() { echo "agent-readiness: $*" >&2; exit 2; }

url="${1:-}"
[[ -n "$url" ]] || usage_error "no URL given (usage: agent-readiness-gate.sh <url>; is AGENT_READINESS_URL set?)"
if [[ -n "${MIN_SCORE:-}" && ! "$MIN_SCORE" =~ ^[0-9]+$ ]]; then
  usage_error "MIN_SCORE must be a whole number from 0 to 100, got \"$MIN_SCORE\""
fi
out="${OUT_DIR:-agent-readiness-report}"
cli="${AGENT_READINESS:-npx --yes agent-readiness-cli@0.4.0}"
# Empty-array expansions below use ${a[@]+...} so bash 3.2 (macOS) works under set -u.
read -r -a extra <<< "${SCAN_ARGS:-}"
# Credentials go in their own variables: values with spaces would break SCAN_ARGS. The CLI only sends them to the target origin.
if [[ -n "${SCAN_HEADER:-}" ]]; then extra+=(--header "$SCAN_HEADER"); fi
if [[ -n "${SCAN_COOKIE:-}" ]]; then extra+=(--cookie "$SCAN_COOKIE"); fi

mkdir -p "$out"

baseline_args=()
if [[ -n "${BASELINE:-}" ]]; then
  if [[ -f "$BASELINE" ]]; then
    baseline_args=(--baseline "$BASELINE")
  else
    echo "agent-readiness: no baseline at $BASELINE, skipping the regression gate" >&2
  fi
fi

# 1. The gating scan: JSON, plus the baseline comparison when one exists.
$cli "$url" ${extra[@]+"${extra[@]}"} ${baseline_args[@]+"${baseline_args[@]}"} --format json > "$out/report.json"
scan_status=$?
if [[ $scan_status -ge 2 ]]; then
  echo "agent-readiness: scan failed (exit $scan_status)" >&2
  exit 2
fi

# 2. Human-readable reports for artifacts, PR comments and job summaries.
$cli "$url" ${extra[@]+"${extra[@]}"} --format html > "$out/report.html" || echo "agent-readiness: HTML report failed" >&2
$cli "$url" ${extra[@]+"${extra[@]}"} --format md > "$out/report.md" || echo "agent-readiness: Markdown report failed" >&2

score="$(node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(r.score?.value ?? ""))' "$out/report.json")"
echo "agent-readiness: score ${score:-n/a}/100 for $url"

status=0
if [[ $scan_status -eq 1 ]]; then
  echo "agent-readiness: regressions against the baseline (details above)" >&2
  status=1
fi
if [[ -n "${MIN_SCORE:-}" ]]; then
  if [[ -z "$score" ]]; then
    echo "agent-readiness: no scored checks ran, so MIN_SCORE=$MIN_SCORE cannot be checked" >&2
    status=1
  elif (( score < MIN_SCORE )); then
    echo "agent-readiness: score $score is below MIN_SCORE=$MIN_SCORE" >&2
    status=1
  fi
fi
exit $status

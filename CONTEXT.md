# agent-readiness

An open-source CLI that scans a URL and reports whether AI agents can find, read, access, use and buy from the site. This repo holds the CLI and its checks; the hosted product lives in a separate, private repo.

## Language

### The project

**Open-source**:
The availability of this repo's code to anyone. Say "open-source" for the code, never "public", which belongs to reports.
_Avoid_: public repo, public code

**CLI**:
The `agent-readiness` command, published to npm as `agent-readiness-cli`.
_Avoid_: tool, scanner (when the hosted scanner could be meant)

**Library**:
The parts of the CLI's code published for other programs to import (scanning, the check list, report rendering), versioned with the CLI.
_Avoid_: SDK, core, API

### Scanning

**Target**:
The origin a scan is about; every default request goes to it.
_Avoid_: site, host, domain (as a scan input)

**Check**:
One named, documented test of a target with a status and a remediation.
_Avoid_: rule, audit, test

**Scored check**:
A check whose pass or fail counts toward the score.
_Avoid_: required check

**Informational check**:
A check that reports a status but never counts toward the score.
_Avoid_: bonus check, advisory

**Site type**:
The kind of target being scanned, which decides which checks apply: `full` or `content`.
_Avoid_: profile, mode, preset (a preset only selects checks)

**Not applicable**:
A check the site type rules out: not run, shown as skipped, and left out of the score.
_Avoid_: N/A, disabled

### Results

**Report**:
The result of one scan of one target: every check's status, the score and the summary.
_Avoid_: result, audit, scan (as a noun for the output)

**Score**:
Passing scored checks as a share of all scored checks that passed or failed, from 0 to 100, with a letter grade.
_Avoid_: rating, readiness level

**Baseline**:
An earlier report of the same target that a new report is compared with.
_Avoid_: snapshot, previous run

**Regression**:
A check that passed in the baseline and fails now, or a new check that fails.
_Avoid_: breakage, failure (alone)

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startFixtureServer, type Fixture } from '../testdata/fixture-server';

// Runs the documented CI gate (examples/ci/agent-readiness-gate.sh) against local fixture
// servers, with the CLI from this checkout in place of the published npm package.
const ROOT = join(import.meta.dir, '..');
const GATE = join(ROOT, 'examples', 'ci', 'agent-readiness-gate.sh');
const CLI = `${process.execPath} ${join(ROOT, 'src', 'cli.ts')}`;
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { name: string; version: string };

let good: Fixture;
let bad: Fixture;
let work: string;

beforeAll(async () => {
  [good, bad] = await Promise.all([startFixtureServer('all-pass'), startFixtureServer('all-fail-spa')]);
  work = await mkdtemp(join(tmpdir(), 'agent-readiness-ci-'));
});
afterAll(async () => {
  await Promise.all([good?.close(), bad?.close()]);
  await rm(work, { recursive: true, force: true });
});

// Async on purpose: the fixture servers live in this process, so a blocking spawn would deadlock.
async function gate(url: string, env: Record<string, string>) {
  const proc = Bun.spawn(['bash', GATE, url], {
    env: { ...process.env, AGENT_READINESS: CLI, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, out, err };
}

const SLOW = 60_000; // each gate run is three scans

async function score(dir: string): Promise<number> {
  return JSON.parse(await readFile(join(dir, 'report.json'), 'utf8')).score.value;
}

describe('CI gate example', () => {
  it('passes a healthy site and writes JSON, HTML and Markdown reports', async () => {
    const out = join(work, 'good');
    const r = await gate(good.url, { OUT_DIR: out, MIN_SCORE: '50' });
    expect(r.code).toBe(0);
    expect(r.out).toContain(`agent-readiness: score ${await score(out)}/100`);
    expect(await readFile(join(out, 'report.html'), 'utf8')).toStartWith('<!doctype html>');
    expect(await readFile(join(out, 'report.md'), 'utf8')).toContain('agent-readiness');
  }, SLOW);

  it('fails when the score is below MIN_SCORE', async () => {
    const out = join(work, 'low');
    const r = await gate(bad.url, { OUT_DIR: out, MIN_SCORE: '50' });
    expect(await score(out)).toBeLessThan(50);
    expect(r.code).toBe(1);
    expect(r.err).toContain('is below MIN_SCORE=50');
    // Reports are still written so CI can upload them.
    expect((await readFile(join(out, 'report.html'), 'utf8')).length).toBeGreaterThan(0);
  }, SLOW);

  it('fails on a regression against a baseline for the same URL, ignoring existing failures', async () => {
    const out = join(work, 'regress');
    const first = await gate(bad.url, { OUT_DIR: out });
    expect(first.code).toBe(0);

    // A baseline identical to the current state: existing failures don't break the build.
    const baseline = join(work, 'baseline.json');
    const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
    await writeFile(baseline, JSON.stringify(report));
    expect((await gate(bad.url, { OUT_DIR: out, BASELINE: baseline })).code).toBe(0);

    // Pretend robots.txt used to pass: now it's a pass -> fail regression.
    const robots = report.checks.find((c: { id: string }) => c.id === 'robots-txt');
    expect(robots.status).toBe('fail');
    robots.status = 'pass';
    await writeFile(baseline, JSON.stringify(report));
    const r = await gate(bad.url, { OUT_DIR: out, BASELINE: baseline });
    expect(r.code).toBe(1);
    expect(r.err).toContain('baseline regressions: robots-txt');
  }, SLOW);

  it('skips the regression check when the baseline file is missing', async () => {
    const r = await gate(good.url, { OUT_DIR: join(work, 'nobase'), BASELINE: join(work, 'missing.json') });
    expect(r.code).toBe(0);
    expect(r.err).toContain('no baseline at');
  }, SLOW);

  it('reports scan errors as exit 2, not as a gate failure', async () => {
    const r = await gate('not a url', { OUT_DIR: join(work, 'err') });
    expect(r.code).toBe(2);
  }, SLOW);

  it('treats a missing URL as a usage error, not a gate failure', async () => {
    // e.g. the AGENT_READINESS_URL repository variable isn't set
    const r = await gate('', { OUT_DIR: join(work, 'nourl') });
    expect(r.code).toBe(2);
    expect(r.err).toContain('no URL given');
  });

  it('rejects a MIN_SCORE that is not a whole number before scanning', async () => {
    const r = await gate(good.url, { OUT_DIR: join(work, 'badmin'), MIN_SCORE: 'seventy' });
    expect(r.code).toBe(2);
    expect(r.err).toContain('MIN_SCORE must be a whole number');
  });

  it('passes a header with spaces through SCAN_HEADER', async () => {
    const r = await gate(good.url, { OUT_DIR: join(work, 'header'), SCAN_HEADER: 'Authorization: Bearer secret token', SCAN_ARGS: '--only robots-txt' });
    expect(r.code).toBe(0);
  }, SLOW);

  it('passes SCAN_ARGS through to the CLI', async () => {
    const out = join(work, 'only');
    const r = await gate(good.url, { OUT_DIR: out, SCAN_ARGS: '--only robots-txt,sitemap' });
    expect(r.code).toBe(0);
    const ids = JSON.parse(await readFile(join(out, 'report.json'), 'utf8')).checks.map((c: { id: string }) => c.id);
    expect(ids.sort()).toEqual(['robots-txt', 'sitemap']);
  }, SLOW);
});

describe('CI workflow examples', () => {
  it('default to the published package at the current version', async () => {
    const script = await readFile(GATE, 'utf8');
    expect(script).toContain(`npx --yes ${pkg.name}@${pkg.version}`);
  });

  type Step = { name?: string; run?: string; uses?: string; if?: string; with?: Record<string, string> };
  type GhJob = { if: string; env: Record<string, string>; steps: Step[] };
  const yaml = async (path: string) => Bun.YAML.parse(await readFile(join(ROOT, path), 'utf8')) as any;

  it('github-actions.yml gates pull requests on their own build and watches production separately', async () => {
    const wf = await yaml('examples/ci/github-actions.yml');
    const build: GhJob = wf.jobs.build;
    const production: GhJob = wf.jobs.production;
    expect(build.if).toContain("'pull_request'");
    // The PR scan targets the app started in the job, never the deployed site.
    expect(build.env.APP_URL).toStartWith('http://localhost');
    expect(JSON.stringify(build)).not.toContain('AGENT_READINESS_URL');
    const runs = build.steps.map((st) => st.run ?? '').join('\n');
    expect(runs).toContain('eval "$START_CMD"');
    expect(runs).toContain('bash scripts/agent-readiness-gate.sh "$APP_URL"');
    expect(build.env.MIN_SCORE).toBeDefined();
    expect(build.env.BASELINE).toBe('.agent-readiness/baseline.json');
    // Production is scheduled, opt-in, and only saves a baseline after a passing scan (no always()/!cancelled()).
    expect(wf.on.schedule).toBeDefined();
    expect(production.if).toContain("vars.AGENT_READINESS_URL != ''");
    const save = production.steps.filter((st) => st.name?.includes('baseline') && !st.name.startsWith('Restore'));
    expect(save.length).toBe(2);
    for (const st of save) expect(st.if).toBeUndefined();
  });

  it('gitlab-ci.yml has the same build and production jobs', async () => {
    const ci = await yaml('examples/ci/gitlab-ci.yml');
    const build = ci['agent-readiness'];
    const production = ci['agent-readiness:production'];
    expect(build.variables.APP_URL).toStartWith('http://localhost');
    expect(JSON.stringify(build)).not.toContain('AGENT_READINESS_URL');
    expect(build.script.join('\n')).toContain('bash scripts/agent-readiness-gate.sh "$APP_URL"');
    expect(build.cache.key).not.toBe(production.cache.key);
    expect(production.rules[0].if).toContain('"schedule"');
    expect(production.script.join('\n')).toContain('if [ "${status:-0}" = 0 ]');
  });

  it("this repo's workflow runs the example gate script on the fixture app", async () => {
    const wf = await yaml('.github/workflows/agent-readiness.yml');
    const runs = (wf.jobs.build.steps as Step[]).map((st) => st.run ?? '').join('\n');
    expect(runs).toContain('bash examples/ci/agent-readiness-gate.sh "$APP_URL"');
    expect(runs).toContain('bun run testdata/serve.ts 8787');
    expect(wf.jobs.build.env.APP_URL).toStartWith('http://127.0.0.1');
  });
});

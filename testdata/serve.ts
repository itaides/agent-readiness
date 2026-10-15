// Serves the all-pass fixture on a fixed port until stopped, for the CI gate in
// .github/workflows/agent-readiness.yml: bun run testdata/serve.ts [port]
import { startFixtureServer } from './fixture-server';

const fixture = await startFixtureServer('all-pass', Number(process.argv[2] ?? 8787));
console.log(`Fixture serving at ${fixture.url}`);

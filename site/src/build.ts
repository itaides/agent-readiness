import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { checks } from '../../src/registry';
import { formatJson } from '../../src/report';
import { formatHtml } from '../../src/report-html';
import { REPO_URL, renderLanding, renderNotFound, renderScanPage } from './pages';
import { sampleReport } from './sample-report';

const ROBOTS_TXT = `# agent-readiness: agents and crawlers welcome
User-agent: *
Allow: /
Disallow: /scan/
`;

function llmsTxt(): string {
  return `# agent-readiness

> Open-source CLI that scores any URL, including localhost, against ${checks.length} AI-agent readiness checks across discoverability, content, bot access, capabilities and commerce. Every failed check comes with a fix and a one-line verify command.

## Use it

- Install: \`bun install -g github:itaides/agent-readiness\`
- Scan: \`agent-readiness https://your-site.com\` (add \`--format json|html|md\`)
- Gate CI on regressions: \`agent-readiness $URL --baseline readiness-baseline.json\`

## Docs

- [README](${REPO_URL}#readme): install, flags and CI usage
- [Check reference](${REPO_URL}/blob/main/docs/checks.md): every check, its endpoint, pass criteria and spec
- [Example report](/example/): HTML report for a sample site
- [Example report JSON](/example/report.json): the same report as JSON
`;
}

/** Writes the static site into outDir: landing, scan placeholder, example report, robots.txt, llms.txt and 404. */
export async function buildSite(outDir: string): Promise<string[]> {
  const report = sampleReport();
  const files: Record<string, string> = {
    'index.html': renderLanding(report),
    'scan/index.html': renderScanPage(),
    'example/index.html': formatHtml(report),
    'example/report.json': formatJson(report),
    '404.html': renderNotFound(),
    'robots.txt': ROBOTS_TXT,
    'llms.txt': llmsTxt(),
  };

  await rm(outDir, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(outDir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, contents);
  }
  return Object.keys(files);
}

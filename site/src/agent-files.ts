import { createHash } from 'node:crypto';

import { checks } from '../../src/registry';
import type { Category } from '../../src/types';
import { VERSION } from '../../src/version';
import { INSTALL_CMD, MARKDOWN_PAGES, NPM_PACKAGE, NPX_CMD, REPO_URL, SITE_URL } from './config';

const CHECKS_DOC_URL = `${REPO_URL}/blob/main/docs/checks.md`;

const CATEGORY_LABEL: Record<Category, string> = {
  discoverability: 'Discoverability',
  content: 'Content',
  'bot-access': 'Bot access',
  capabilities: 'Capabilities',
  commerce: 'Commerce',
};

// The crawlers the ai-bot-rules and bot-policy-matrix checks know about. The site welcomes
// all of them, including training crawlers, so each gets an explicit group with the same rules.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended',
  'Meta-ExternalAgent', 'Amazonbot', 'Bytespider', 'CCBot', 'cohere-ai',
];

/** Pages listed in the sitemaps. /scan/ is a noindex placeholder and stays out. */
const PAGES = [
  { path: '/', title: 'agent-readiness: can AI agents use your site?' },
  { path: '/example/', title: 'Example agent-readiness report' },
];

const GROUP_RULES = 'Allow: /\nDisallow: /scan/';

export function robotsTxt(): string {
  const groups = ['*', ...AI_BOTS].map((ua) => `User-agent: ${ua}\n${GROUP_RULES}`).join('\n\n');
  return `# agent-readiness: agents and crawlers welcome, including for AI training.
${groups}

Content-Signal: search=yes, ai-input=yes, ai-train=yes

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function sitemapXml(lastmod: string): string {
  const urls = PAGES.map((p) => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function sitemapMd(): string {
  const lines = PAGES.map((p) => `- [${p.title}](${SITE_URL}${p.path}) ([Markdown](${SITE_URL}${MARKDOWN_PAGES[p.path]}))`);
  return `# agent-readiness sitemap

${lines.join('\n')}
- [llms.txt](${SITE_URL}/llms.txt)
- [llms-full.txt](${SITE_URL}/llms-full.txt)
- [AGENTS.md](${SITE_URL}/AGENTS.md)
`;
}

function checksByCategory(): string {
  const byCat = new Map<Category, typeof checks>();
  for (const c of checks) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
  return [...byCat]
    .map(([cat, cs]) => `### ${CATEGORY_LABEL[cat]} (${cs.length})\n\n${cs.map((c) => `- \`${c.id}\`: ${c.title}${c.scored ? '' : ' (informational)'}${c.defaultEnabled ? '' : ' (opt-in)'}`).join('\n')}`)
    .join('\n\n');
}

const USAGE = `\`\`\`sh
${NPX_CMD} https://your-site.com                 # run without installing
${INSTALL_CMD}                  # or install the agent-readiness command
agent-readiness http://localhost:3000             # scan a local dev server
agent-readiness https://your-site.com --format json   # json, html or md
agent-readiness $PREVIEW_URL --baseline readiness-baseline.json   # CI: fail only on regressions
\`\`\``;

export function llmsTxt(): string {
  return `# agent-readiness

> Open-source CLI that scores any URL, including localhost, against ${checks.length} AI-agent readiness checks across discoverability, content, bot access, capabilities and commerce. Every failed check comes with a fix and a one-line verify command.

## Use it

- Run: \`${NPX_CMD} https://your-site.com\` (Node 20+ or \`bunx\`)
- Install: \`${INSTALL_CMD}\`, then \`agent-readiness https://your-site.com\` (add \`--format json|html|md\`)
- Gate CI on regressions: \`agent-readiness $URL --baseline readiness-baseline.json\`

## Docs

- [README](${REPO_URL}#readme): install, flags and CI usage
- [Check reference](${CHECKS_DOC_URL}): every check, its endpoint, pass criteria and spec
- [Example report](${SITE_URL}/example/): HTML report for a sample site ([Markdown](${SITE_URL}/example/index.md), [JSON](${SITE_URL}/example/report.json))
- [AGENTS.md](${SITE_URL}/AGENTS.md): how a coding agent should run the CLI

## Optional

- [llms-full.txt](${SITE_URL}/llms-full.txt): this file plus the full check reference
`;
}

/** llms.txt followed by the full check reference from docs/checks.md. */
export function llmsFullTxt(checksDoc: string): string {
  return `${llmsTxt()}
---

${checksDoc.trim()}
`;
}

export function landingMarkdown(): string {
  return `# agent-readiness: can AI agents actually use your site?

Open-source CLI (MIT) that scores any URL, including localhost, staging and CI previews, against ${checks.length} checks for discovery, content, bot access, capabilities and commerce. Every failure comes with a fix and a command to verify it.

## Install and run

${USAGE}

Version ${VERSION}, published on npm as [\`${NPM_PACKAGE}\`](https://www.npmjs.com/package/${NPM_PACKAGE}). Source: ${REPO_URL}

## What it checks

${checksByCategory()}

Full pass criteria, endpoints and spec links: ${CHECKS_DOC_URL}

## Gate it in CI

Save a JSON report on main, then pass it as \`--baseline\` on every PR. The scan exits 1 only when a check goes from pass to fail or a new check fails.

## Links

- [Example report](${SITE_URL}/example/) ([Markdown](${SITE_URL}/example/index.md))
- [llms.txt](${SITE_URL}/llms.txt)
- [GitHub](${REPO_URL})
`;
}

export function agentsMd(): string {
  return `# AGENTS.md: running agent-readiness

Instructions for coding agents that want to check whether a website is ready for AI agents.

## Install

Needs Node.js 20+ (or Bun). No API key, account or configuration.

\`\`\`sh
${INSTALL_CMD}
\`\`\`

Or run it without installing: \`${NPX_CMD} <url>\`.

## Usage

${USAGE}

- Output formats: \`--format human|json|html|md\`. Use \`json\` when you need to parse results.
- Every failed or warning check includes \`remediation.suggestion\` and \`remediation.verifyCommand\`; run the verify command after a fix.
- Exit codes: 0 scan completed, 1 baseline regression, 2 bad input or network error.

## Configuration

There are no config files or environment variables. Everything is a flag:

- \`--only id1,id2\` / \`--skip id\` / \`--preset content|api|commerce\` choose checks (\`--list-checks\` lists ids).
- \`--include-llms-txt\`, \`--include-agents-md\`, \`--commerce-url <url>\`, \`--mcp-url <url>\` and \`--browser\` turn on opt-in checks.
- \`--header "K: V"\`, \`--cookie <value>\` and \`--user-agent <ua>\` shape requests; \`--insecure\` skips TLS checks (automatic for localhost and private IPs).

## Safety

Scans are read-only. Default checks contact only the target origin and its DNS resolver. Commerce checks never pay, and MCP checks never call tools.
`;
}

export function skillMd(): string {
  return `---
name: agent-readiness
description: Check whether a website is ready for AI agents (robots.txt, sitemaps, llms.txt, markdown negotiation, MCP and A2A cards, OAuth metadata, bot access, commerce) and get a fix plus a verify command for each failing check.
---

# agent-readiness

Use this skill when asked whether a site works for AI agents, or to audit or fix its agent-facing files and headers.

1. Scan the site: \`${NPX_CMD} <url> --format json\`. It works on localhost and private networks.
2. Read \`checks[]\`: each has \`status\` (pass, fail, warn, skip), \`message\` and, for failures and warnings, \`remediation.suggestion\` and \`remediation.verifyCommand\`.
3. Fix failures in the site's code, then run each \`verifyCommand\` to confirm.
4. To keep it fixed, save the JSON report and gate CI with \`--baseline <report.json>\`.

Checks: ${CHECKS_DOC_URL}
`;
}

function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export const SKILL_PATH = '.well-known/agent-skills/agent-readiness/SKILL.md';

export function skillsIndex(skill: string): string {
  return `${JSON.stringify({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'agent-readiness',
        type: 'skill-md',
        description: 'Scan any URL, including localhost, for AI-agent readiness and fix what fails, using the agent-readiness CLI.',
        url: `/${SKILL_PATH}`,
        digest: sha256(skill),
      },
    ],
  }, null, 2)}\n`;
}

/** TDMRep: no text-and-data-mining reservation anywhere on the site. */
export function tdmrepJson(): string {
  return `${JSON.stringify([{ location: '/*', 'tdm-reservation': 0 }], null, 2)}\n`;
}

/** Static-asset headers. Responses for MARKDOWN_PAGES come from the Worker, which sets its own. */
export function headersFile(): string {
  return `/*.md
  Content-Type: text/markdown; charset=utf-8
  Content-Signal: search=yes, ai-input=yes, ai-train=yes

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
`;
}

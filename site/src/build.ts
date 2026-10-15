import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { formatJson, formatMarkdown } from '../../src/report';
import { formatHtml } from '../../src/report-html';
import { minifyCss, minifyJs } from '../../src/report-html/minify';
import { REPORT_JS } from '../../src/report-html/script';
import {
  SKILL_PATH,
  agentsMd,
  headersFile,
  landingMarkdown,
  llmsFullTxt,
  llmsTxt,
  robotsTxt,
  sitemapMd,
  sitemapXml,
  skillMd,
  skillsIndex,
  tdmrepJson,
} from './agent-files';
import { renderLanding, renderNotFound, renderScanPage } from './pages';
import { sampleReport } from './sample-report';
import { SITE_CSS } from './styles';

const CHECKS_DOC = join(import.meta.dir, '..', '..', 'docs', 'checks.md');

/**
 * Writes the static site into outDir: the pages, a Markdown version of each indexable page, and the
 * agent-facing files (robots.txt, sitemaps, llms.txt, AGENTS.md, Agent Skills, TDMRep, _headers).
 */
export async function buildSite(outDir: string, now = new Date()): Promise<string[]> {
  const updated = now.toISOString().slice(0, 10);
  const report = sampleReport();
  const skill = skillMd();
  const files: Record<string, string> = {
    'index.html': renderLanding(report, updated),
    'index.md': landingMarkdown(),
    'scan/index.html': renderScanPage(),
    'example/index.html': formatHtml(report),
    'example/index.md': formatMarkdown(report),
    'example/report.json': formatJson(report),
    '404.html': renderNotFound(),
    'robots.txt': robotsTxt(),
    'sitemap.xml': sitemapXml(updated),
    'sitemap.md': sitemapMd(),
    'llms.txt': llmsTxt(),
    'llms-full.txt': llmsFullTxt(await readFile(CHECKS_DOC, 'utf8')),
    'AGENTS.md': agentsMd(),
    [SKILL_PATH]: skill,
    '.well-known/agent-skills/index.json': skillsIndex(skill),
    '.well-known/tdmrep.json': tdmrepJson(),
    // Same-origin files rather than inline, so pages stay mostly text and the styles are cached.
    'assets/site.css': minifyCss(SITE_CSS),
    'assets/site.js': minifyJs(REPORT_JS),
    _headers: headersFile(),
  };

  await rm(outDir, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(outDir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, contents);
  }
  return Object.keys(files);
}

// Build-time minification for the report's inline CSS and JS. index.ts imports these as Bun
// macros, so the bundle only carries the minified strings. The bundler's --minify leaves
// string contents alone, and these two strings are most of the HTML report's size.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPORT_JS } from './script';
import { REPORT_CSS } from './styles';

// Conservative on purpose: Bun's CSS minifier lowers light-dark() into variables that need
// Bun's own injected rules, which an inline <style> doesn't have. This only drops comments
// and whitespace that can't change meaning, and leaves quoted strings and the space in
// descendant selectors (`.ar :is(...)`) as they are.
export function minifyCss(css: string): string {
  return css
    .split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/)
    .map((part, i) => (i % 2 === 1
      ? part
      : part
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/ ?([{};,]) ?/g, '$1')
        .replace(/: /g, ':')
        .replace(/;}/g, '}')))
    .join('')
    .trim();
}

// The bundler can't be called in-process from a macro (it would wait on itself), so run the
// CLI as Bun's error message recommends.
export function minifyJs(js: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-readiness-'));
  try {
    const file = join(dir, 'report.js');
    writeFileSync(file, js);
    const result = Bun.spawnSync([process.execPath, 'build', file, '--minify', '--target=browser']);
    if (result.exitCode !== 0) throw new Error(`Could not minify report JS: ${result.stderr.toString()}`);
    return result.stdout.toString().trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function reportCss(): string {
  return minifyCss(REPORT_CSS);
}

export function reportJs(): string {
  return minifyJs(REPORT_JS);
}

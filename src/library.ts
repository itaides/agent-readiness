// The experimental library entry point, `agent-readiness-cli/library`: scanning, the check list and
// report rendering for programs that run scans themselves. Any 0.x minor release may change it.
export { scan, type ScanOptions } from './scanner';
export { createTarget, type CreateTargetOptions } from './target';
export { createHttpClient, type HttpClientOptions } from './http';
export { checks, PRESETS, NOT_APPLICABLE, SITE_TYPES } from './registry';
export { addRemediation } from './remediation';
export { formatJson, formatMarkdown } from './report';
export { formatHtml, resolveScore, REPORT_CSS, REPORT_JS, type HtmlOptions } from './report-html';
export { VERSION } from './version';
export type * from './types';

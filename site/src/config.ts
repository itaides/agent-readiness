// Absolute URLs (sitemap, canonical links, robots.txt) need the deployed origin. Override at
// build time with SITE_URL when the site moves to a custom domain.
export const SITE_URL = (process.env.SITE_URL ?? 'https://agent-readiness-site.itaios052.workers.dev').replace(/\/+$/, '');

export const REPO_URL = 'https://github.com/itaides/agent-readiness';
export const NPM_PACKAGE = '@itaides/agent-readiness';
export const INSTALL_CMD = `npm install -g ${NPM_PACKAGE}`;
export const NPX_CMD = `npx ${NPM_PACKAGE}`;

export { MARKDOWN_PAGES } from './markdown-pages';

// Shared by the build and the Worker, so it must not touch build-time globals like process.env.

/** HTML pages that also have a Markdown version, keyed by path. The Worker serves these for Accept: text/markdown. */
export const MARKDOWN_PAGES: Record<string, string> = {
  '/': '/index.md',
  '/example/': '/example/index.md',
};

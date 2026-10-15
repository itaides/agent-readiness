# Publish a per-page markdown mirror

Expose the content page as markdown at `<page>.md` (or `<page>.html.md` for .html URLs, `index.md` for directory URLs) returning 200 with a markdown or text/plain content type and non-empty non-HTML content, generated from the same source as the HTML page. Alternatively advertise the mirror with `Link: rel="alternate" type="text/markdown"`. Verify with `agent-readiness <url> --only markdown-mirror`.

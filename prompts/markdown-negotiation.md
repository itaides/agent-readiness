# Add Markdown content negotiation

When the selected content URL receives `Accept: text/markdown`, return non-empty Markdown with `Content-Type: text/markdown`. Keep ordinary browser HTML behavior unchanged and verify with `agent-readiness <url> --only markdown-negotiation`.

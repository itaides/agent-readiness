# Make the page agent-readable HTML

Serve the content page as HTTP 200 text/html within one redirect and put real content in the initial HTML — server-side render or prerender so the text-to-HTML ratio exceeds 15% (no empty SPA shell). Add `<html lang>`, a meta description of at least 50 characters, `og:title` and `og:description`, a canonical link, and at least three h1–h3 headings. Verify with `agent-readiness <url> --only page-html-quality`.

# Community research: what people want from "agent-ready" websites

Compiled 2026-10-13 from Reddit threads (r/webdev, r/SEO, r/LocalLLaMA), Discord/dev-community discussions, HN, and the published checklists people keep citing: Vercel's agent-readability spec, agent-ready.dev, squirrelscan's AX audit, axd.md, agents-txt.com, and llmstxt.org.

## What people actually ask about

The questions cluster into five buckets, in rough order of frequency:

1. **"Agents get a blank page / can't read my content."** The single most common complaint. SPAs returning an empty HTML shell, JS-gated content, and heavy DOMs that waste agent context. Fixes people converge on: SSR/prerendering, text-to-HTML ratio, real content in the initial response.
2. **"Which files do I need to publish?"** `llms.txt` (and whether it helps), `llms-full.txt`, `AGENTS.md`, `.md` page mirrors, `sitemap.md`, `agents.txt`/`agents.json`. Also *how* agents discover these files — root path vs `Link` header vs `robots.txt` reference — is itself a recurring question (hiding a `<link>` in HTML is widely regarded as wrong; the answer is the known path + `Link`/`rel` headers).
3. **"Am I accidentally blocking the agents I want?"** robots.txt bot allowlists (covered), but also `X-Robots-Tag: noai/noindex/nosnippet` headers, CDN/WAF rules that 403 GPTBot while allowing browsers, and the newer purpose-based signals (TDMRep, ai.txt) people use alongside Content Signals.
4. **"Can the agent trust/cite what it found?"** Freshness and identity signals: sitemap `lastmod`, `datePublished`/`dateModified`, canonical URLs, consistent brand naming across `<title>`/`og:title`/JSON-LD `Organization`. GEO research keeps finding explicit facts + recent timestamps drive citations.
5. **"Can the agent *do* something, not just read?"** MCP/A2A/cards (covered), plus OpenAPI spec discoverability and semantic, stable HTML controls (real `<button>`/`<a>`, descriptive labels, aria) for browser-driving agents.

Less frequent but real: "how do I see agent traffic in my logs" (analytics — out of scope for a scanner), "audit my whole site not one URL" (crawl/sample mode), and scoring — every public tool shows a 0–100 score and people benchmark against it.

## Coverage vs. current checks

Covered today: robots.txt, sitemap.xml, `Link` api-catalog, DNS-AID, markdown content-negotiation, llms.txt (opt-in), Content Signals, AI bot rules, bot policy matrix, Web Bot Auth, A2A card, Agent Skills, api-catalog, OAuth AS/PRM, MCP server card, WebMCP, auth.md, MCP `server/discover`, Lighthouse agentic, UCP/x402/MPP.

Not covered — the gaps, mapped to check proposals in this repo's style:

### High demand, cheap fetch-only checks

| Proposed check | Category | Scored? | Pass criteria (draft) | Source |
|---|---|---|---|---|
| `agents-md` | Content | scored, opt-in (like llms.txt) | `GET /AGENTS.md` (fallbacks `/.well-known/agents.md`, `/CLAUDE.md`) → 200, markdown/plain, non-empty, ≥2 of install/config/usage sections | [Vercel agent-readability spec](https://vercel.com/kb/guide/agent-readability-spec), agents.md convention (60k+ projects) |
| `markdown-mirror` | Content | scored | `GET <content-url>.md` and/or `<content-url>.html.md` → 200 `text/markdown`, non-empty, not HTML. Complements `markdown-negotiation` — different surface, more common in the wild | [llmstxt.org](https://llmstxt.org/), Vercel `.md` endpoints |
| `markdown-link-rel` | Content | informational | Page or its markdown endpoint advertises `Link: rel="alternate" type="text/markdown"` and/or `rel="describedby"` → llms.txt | llmstxt.org link-relations section |
| `page-html-quality` | Content | scored | On the content URL: 200 with ≤1 redirect, `text/html`, non-SPA shell (text-to-HTML ratio >15%), `<html lang>`, meta description ≥50 chars, `og:title`/`og:description`, canonical link, ≥3 h1–h3 | Vercel spec page-level block, the Reddit "9/100 audit" checklist |
| `json-ld` | Content | scored | ≥1 `application/ld+json` block that parses and has `@type`; warn if only microdata/RDFa | schema.org/GEO guidance — the "2.5× more cited" claim people repeat |
| `x-robots-tag` | Bot access | scored | No `X-Robots-Tag`/`noai`/`noindex`/`nosnippet` on the content response (or report restrictive values as fail) — direct agent-blocking signal robots.txt can't express | purpose-based control discussions |
| `agents-txt` | Capabilities | informational | `GET /agents.txt` or `/agents.json` → non-empty capability declaration | [agents-txt.com spec](https://agents-txt.com/) (CC0, early) |
| `tdmrep` | Bot access | informational | `/.well-known/tdmrep.json`, `TDM-Reservation` header, or `/ai.txt` present → report declared policy | TDMRep/ai.txt (~21% of scanned sites serve a TDM signal) |

### Medium demand / medium effort

| Proposed check | Notes |
|---|---|
| `sitemap-lastmod` | Extend `sitemap` or new warn-level check: fraction of `<url>` entries carrying `lastmod`. Agents use it for freshness; explicitly on every checklist. |
| `llms-full-txt` | Sibling of `llms.txt`; trivial add once llms.txt check exists — share the fetch helper. |
| `sitemap-md` | Vercel convention (`GET /sitemap.md` → markdown index). Informational; very new. |
| `openapi-discovery` | `GET /openapi.json`/`/swagger.json` or link from api-catalog/page → parses as OpenAPI 3.x. "Clean typed API" is the top ask in the "agent-ready web app" threads. |
| `bot-ua-differential` | Fetch content URL as browser UA vs `GPTBot`/`ClaudeBot` UA → flag 403/blocked differential ("am I accidentally blocking agents?"). We already have `--user-agent`; this automates the comparison. 2 requests, safe. |
| `semantic-controls` | Fetch-only heuristic for browser agents: interactive elements are `<a>`/`<button>` not `div[onclick]`, buttons/links have non-generic text, form fields labelled. Overlaps Lighthouse agentic but works without `--browser`. |
| `freshness-signals` | JSON-LD `datePublished`/`dateModified` or visible last-updated on the content page. Informational. |
| `rss-atom` | `Link`/`link` tag for RSS/Atom feed → feed validates. Machine-readable fresh-content channel people still ask for. |

### Product-level asks (not per-check)

- **Multi-page / sampled crawl mode** (`--crawl <n>`): Vercel's spec scores per-page checks across discovered pages; people ask "audit my site" not "audit this URL". We could sample N URLs from the sitemap and aggregate page-level checks. Biggest feature gap vs. competing tools.
- **0–100 score**: every public tool shows one and users benchmark with it. Optional `--score` rollup over scored checks; keeps current category pass/fail semantics.
- **`Vary: Accept` correctness**: fold into `markdown-negotiation` — a markdown response without `Vary: Accept` can poison shared caches; people flag this specifically.

## Suggested sequencing

1. `page-html-quality` + `markdown-mirror` + `agents-md` — highest ask volume, all fetch-only, all fit the existing strict-shape model.
2. `x-robots-tag`, `sitemap-lastmod`, `llms-full-txt`, `openapi-discovery`, `bot-ua-differential`.
3. Informational: `agents-txt`, `tdmrep`, `markdown-link-rel`, `sitemap-md`, `freshness-signals`, `rss-atom`.
4. Larger: `--crawl` sampled multi-page mode; optional `--score`.

Per repo policy (docs/roadmap.md): drafts without stable public pass criteria stay informational or on the watchlist — `agents-txt`, `tdmrep`, and `sitemap-md` qualify for informational, not scored defaults.

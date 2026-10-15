# Design handoff: hosted scanner, version 1

Four small additions that turn the existing site into a hosted scanner. Everything else on the landing page and in the HTML report stays exactly as it is. Nothing here is built yet; this is the spec for the frontend, plus the backend behaviour the copy promises.

- **Design:** the "Hosted scanner" page of the Agent Readiness Web UI canvas (Claude Design). Each addition has a desktop board (1280) and a phone board (390), each with a light/dark switch.
- **Components:** the agent-readiness design system (`components/bundle.css`): ScanField, Button, ScoreRing, CategoryCard, CheckRow, FixCallout, StatusBadge, ScoreBadge, FilterChips, ProbeLog, Command. No new colours, fonts or icons: the additions only compose existing tokens.
- **Voice:** plain, second person, sentence case, no emoji, exact numbers. Status is always shown with a word or glyph as well as colour.

## Where each addition goes

| # | Addition | Lives in | Replaces |
|---|---|---|---|
| 1 | Scan options under the field | `scanForm()` in `site/src/pages.ts` | Nothing. Inserted between the form and `.scan-note` |
| 2 | `/scan/` while a scan runs | `renderScanPage()` in `site/src/pages.ts` | Today's "Hosted scans are rolling out" placeholder |
| 3 | Visibility bar above the report | `formatHtml` in `src/report-html/index.ts`, hosted pages only | Nothing. Inserted between `header.topbar` and `main` |
| 4 | Error states on `/scan/` | `renderScanPage()` | Shown in place of the progress block, one at a time |

The CLI's own HTML report (`--format html`) never shows the bar from addition 3. The bar exists only on hosted pages.

## 1. Scan options under the field

Two compact choices and one line that says where the report will live.

```html
<div class="scan-opts">
  <div class="opt-row">
    <fieldset class="opt">
      <legend class="opt-label">Report</legend>
      <span class="segmented">
        <label><input type="radio" name="visibility" value="public" checked>Public</label>
        <label><input type="radio" name="visibility" value="unlisted">Unlisted</label>
      </span>
    </fieldset>
    <fieldset class="opt">
      <legend class="opt-label">Site type</legend>
      <span class="segmented">
        <label><input type="radio" name="type" value="full" checked>Full scan</label>
        <label><input type="radio" name="type" value="content">Content site</label>
      </span>
    </fieldset>
  </div>
  <p class="lives" aria-live="polite">…</p>
</div>
```

- The radios belong to the existing `<form class="scan" action="/scan/" method="get">` (use `form="…"` or move them inside it), so `/scan/` receives `?url=…&visibility=public|unlisted&type=full|content`.
- Defaults: **Public** and **Full scan**.
- The `.lives` line switches with CSS `:has()`, so no JS is needed:

| Selection | Line |
|---|---|
| Public | Listed at `/score/your-site.com` and indexed by search engines. Rescans update the same page. |
| Unlisted | A private link at `/r/<token>`. Not listed, not indexed, deleted after 30 days. |
| + Content site | Appends: Content site skips the API and auth checks and leaves them out of the score. |

- The segmented control is the FilterChips pill style at 32px: the selected option is filled `fg` on `bg`, with a focus ring on `:has(:focus-visible)`.
- **Phone:** the two choices stack, each label on the left with its control on the right.
- **Note under the field:** once hosted scans are live, `.scan-note` changes from "Hosted scans are rolling out; the CLI below runs the same checks today." to:

  > No sign-up. Free, up to 30 scans a day. A site scanned in the last 6 hours opens its saved report.

  Until then, keep the current note and hide `.scan-opts`.

## 2. `/scan/` while a scan runs (2–5 s)

Top to bottom, in a single column with a 760px max width:

1. **Target:** "Scanning" eyebrow, then the URL in the `target` mono style with the scheme in `faint`.
2. **Progress:** "**18** of **30** checks" with elapsed time on the right (`2.4 s`, mono, `faint`), then an 8px bar filled with `accent`. Use `role="progressbar"` with `aria-valuemin/max/now`.
3. **Categories:** five cards, one per category, each with a state word, the name and "n of m":

| State | Word | Treatment |
|---|---|---|
| done | DONE + check glyph | word in `pass` |
| running | RUNNING + spinner | `accent` border and word; the spinner stops under reduced motion |
| queued | QUEUED | word in `muted` |

   The five totals must add up to the overall total. In the example: 5 + 8 + 7 + 7 + 3 = 30, with 5 + 8 + 5 = 18 done.
4. **Live request log:** the existing ProbeLog (`method · path · status`). New lines append at the bottom and step in 90ms apart, the design system's ProbeLog motion.
5. **Note:** "Requests come from `agent-readiness/<version>` and are read-only. The report opens here when the last check finishes."

The whole block is `aria-live="polite"`. When the scan finishes, go straight to the report (`/score/<domain>` or `/r/<token>`). There's no "done" screen.

**Phone:** the category cards use two columns. The log wraps long paths (`overflow-wrap: anywhere`).

## 3. Visibility bar above the report

A thin bar (about 52px) on `surface` with a bottom hairline, placed between the report's existing `header.topbar` and `main`. In order:

| Element | Public | Unlisted |
|---|---|---|
| Pill (uppercase, neutral: `sunken` fill, `border-strong` edge, globe or lock icon) | PUBLIC | UNLISTED |
| One line, `muted` | Listed and indexed. Anyone can find it. | Only people with this link can open it. Not indexed. Deleted on **14 Nov 2026**. |
| Address (mono) + Copy link (`btn sm`) | `/score/shop.example.com` | `/r/k7m2q9xd` |
| Right side | "Saved report from 2 hours ago" + Rescan (`btn sm`) | Same, plus **Make this report public** (`btn sm`) |

- The pills are deliberately **neutral**. Status colours mean check results only.
- "Saved report from …" is relative time. Put the absolute UTC timestamp in a `title` attribute.
- Unlisted pages send `<meta name="robots" content="noindex">` and `X-Robots-Tag: noindex`. Public pages are listed in the sitemap.
- **Phone:** a two-column grid. The pill and its line span the full width; the address and saved time sit on the left with Copy link and Rescan on the right. "Make this report public" spans the full width.

The rest of the report is the existing `formatHtml` output, unchanged.

## 4. Error states on `/scan/`

Each is a card (`surface`, `r-panel`, 24px padding) with a neutral icon tile, an 18px heading, a body line and an action. Use `role="alert"`.

| State | Heading | Body | Action |
|---|---|---|---|
| Private address (localhost, RFC1918, link-local, `.local`, loopback IPv6) | That address is on a private network | The hosted scanner only reaches public sites, so it can't open `localhost:3000`. Run the same scan on your machine: + Command block `npx agent-readiness-cli http://localhost:3000` (the submitted URL) | Scan another URL |
| Daily limit | You've run 30 scans today | Scans reset in **3 h 12 min**. Saved reports still open, and the CLI has no daily limit. + Command block for the submitted URL | None |
| No response | shop.example.com didn't respond within 10 seconds | Nothing was scored. Check that the site is up and reachable from the internet, then try again. + one-line ProbeLog with the last request (`timeout 10 s`, `fail`) | Try again |

The reset time is exact, counts down, and has no seconds.

## Backend behaviour the copy promises

The UI text commits the backend to these rules. Change the copy if any of them change.

- **Free, no account.** No sign-up, no email.
- **30 scans a day per person.** Limited per IP, resetting 24 hours after the first scan. Saved reports never count toward the limit.
- **6-hour cache.** A site scanned in the last 6 hours opens its saved report instead of scanning again. Rescan forces a fresh scan.
- **Public reports** live at `/score/<domain>`, are indexed, and a rescan updates the same page.
- **Unlisted reports** live at `/r/<token>`, are not listed or indexed, and are deleted 30 days after the scan. Tokens are random and unguessable (at least 8 characters, base32).
- **Content site** skips the API and auth checks and leaves them out of the score.
- **Public sites only.** Private, loopback and link-local addresses are refused before any request is made, including after DNS resolution and redirects.
- **10-second response timeout** per site. Requests are read-only (GET and HEAD) and use the CLI's user agent.

## Open decisions

1. **Domain.** `/score/` and `/r/` paths are shown without a host until the domain is chosen (the site is on `workers.dev` today).
2. **Rescans.** Does Rescan on a saved report count toward the 30 a day, and is there a separate per-site rescan limit?
3. **Failed scans.** Does a site that doesn't respond count toward the 30?
4. **Content site detection.** User-picked only for now. Should the scanner suggest it when it finds no APIs?
5. **Public by default.** Defaulting to Public grows the index, but it makes every scan listed unless the user changes it. Unlisted is the more cautious default.

## Acceptance criteria

- [ ] The landing page and report are byte-identical to today outside the four additions (except the `.scan-note` copy once hosted scans are live).
- [ ] `.scan-opts` works without JS: the radios submit with the form and the `.lives` line switches with `:has()`.
- [ ] Every addition works at 375px with no horizontal scroll, and in light and dark.
- [ ] Category totals on `/scan/` add up to the overall check count; done counts add up to the progress number.
- [ ] Unlisted pages are `noindex` (meta and header) and missing from the sitemap.
- [ ] Error cards use `role="alert"`, and the progress region is `aria-live="polite"`.
- [ ] Motion (spinner, probe log steps) is off under `prefers-reduced-motion`.
- [ ] Status colours appear only on check results and grade bands, never on the visibility pills or error cards.

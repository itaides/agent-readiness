// Generated from the design canvas (Agent Readiness Web UI). Plain CSS, no framework.
export const REPORT_CSS = String.raw`
@layer tokens, base, layout, components, states, motion, print;

@property --value { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --n { syntax: "<integer>"; inherits: false; initial-value: 0; }

@layer tokens {
  .ar {
    color-scheme: light dark;
    --bg: light-dark(oklch(97.3% .003 265), oklch(14.5% .006 260));
    --surface: light-dark(oklch(100% 0 0), oklch(18.6% .01 260));
    --sunken: light-dark(oklch(96% .004 265), oklch(16% .008 260));
    --border: light-dark(oklch(91.5% .008 265), oklch(26.5% .015 260));
    --border-strong: light-dark(oklch(84.5% .012 260), oklch(34% .02 265));
    --fg: light-dark(oklch(17% .01 260), oklch(93.5% .006 260));
    --muted: light-dark(oklch(47% .03 260), oklch(72% .02 260));
    --faint: light-dark(oklch(53% .025 260), oklch(64% .02 260));
    --accent: light-dark(oklch(49% .21 267), oklch(73% .15 272));
    --on-accent: light-dark(oklch(100% 0 0), oklch(14.5% .006 260));
    --pass: light-dark(oklch(51% .14 150), oklch(79% .16 152));
    --fail: light-dark(oklch(52% .19 30), oklch(75% .15 28));
    --warn: light-dark(oklch(50% .11 65), oklch(83% .13 85));
    --skip: light-dark(oklch(47% .03 260), oklch(74% .02 260));
    --tint: 12%;
    --line: 34%;
    --r-card: 12px;
    --r-box: 10px;
    --r-ctl: 8px;
    --r-badge: 6px;
    --ease-out: cubic-bezier(.2, .7, .2, 1);
    --dur-1: .15s;
    --dur-2: .25s;
    --dur-3: .5s;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }
  :where([data-status="pass"]) { --status: var(--pass); }
  :where([data-status="fail"]) { --status: var(--fail); }
  :where([data-status="warn"]) { --status: var(--warn); }
  :where([data-status="skip"]) { --status: var(--skip); }
}

@layer base {
  :root { color-scheme: light dark; }
  body { margin: 0; }
  .ar {
    container: report / inline-size;
    background: var(--bg);
    color: var(--fg);
    font: 15px/1.5 var(--sans);
    -webkit-font-smoothing: antialiased;
    min-block-size: 100dvb;
    interpolate-size: allow-keywords;
    accent-color: var(--accent);
    & :where(*, ::before, ::after) { box-sizing: border-box; }
    & :where(h1, h2, h3) { text-wrap: balance; }
    & :where(p) { text-wrap: pretty; margin: 0; }
    & :where(a) { color: var(--accent); text-decoration: none; &:hover { text-decoration: underline; } }
    & :where(code, pre, .mono) { font-family: var(--mono); }
    & :where(svg) { display: block; flex: none; }
    & :where(button, input) { font: inherit; color: inherit; }
    & :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  }
  .vh { position: absolute; inline-size: 1px; block-size: 1px; overflow: clip; clip-path: inset(50%); white-space: nowrap; }
}

@layer layout {
  .wrap { max-inline-size: 1180px; margin-inline: auto; padding-inline: clamp(16px, 3cqi, 24px); }
}

@layer components {
  .topbar {
    background: var(--surface);
    border-block-end: 1px solid var(--border);
    & .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-block-size: 56px; }
  }
  .brand { display: flex; align-items: center; gap: 10px; font: 600 14px var(--mono); & .tick { stroke: var(--accent); } }
  .toplinks {
    display: flex; gap: 20px; font-size: 13px;
    @container report (inline-size < 560px) { & a:not(:last-child) { display: none; } }
  }

  .hero {
    display: grid; justify-items: center; text-align: center; gap: 20px; padding-block: 32px 24px;
    @container report (inline-size >= 720px) {
      grid-template-columns: auto minmax(0, 1fr); align-items: center; justify-items: start; text-align: start;
      column-gap: 48px; padding-block: 48px 36px;
    }
  }
  .meta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; inline-size: 100%; min-inline-size: 0; }
  .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .target {
    margin: 0; font: 600 clamp(20px, 2.8cqi, 28px)/1.2 var(--mono); letter-spacing: -.02em; overflow-wrap: anywhere;
    & span { color: var(--faint); font-weight: 400; }
  }
  .scanned, .stats, .verdict {
    display: flex; flex-wrap: wrap; justify-content: center;
    @container report (inline-size >= 720px) { justify-content: start; }
  }
  .scanned { gap: 4px 14px; font-size: 13px; color: var(--muted); }
  .stats { gap: 8px; }
  .stat {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px;
    border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-ctl);
    font-size: 13px; color: var(--muted);
    &::before { content: ""; inline-size: 8px; block-size: 8px; border-radius: 2px; background: var(--status); }
    & b { color: var(--fg); font-family: var(--mono); font-weight: 600; }
  }
  .cmd {
    display: flex; align-items: center; gap: 10px; inline-size: 100%; text-align: start;
    background: var(--sunken); border: 1px solid var(--border); border-radius: var(--r-box);
    padding: 6px 6px 6px 14px; font: 13px var(--mono);
    & code { flex: 1; min-inline-size: 0; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
    & .pr { color: var(--faint); }
  }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: none;
    min-block-size: 36px; padding-inline: 12px; border-radius: var(--r-ctl);
    border: 1px solid var(--border-strong); background: var(--surface); font: 500 13px var(--sans); cursor: pointer;
    &:hover { background: var(--sunken); }
  }

  .ring {
    display: grid; place-items: center; inline-size: clamp(156px, 18cqi, 184px); aspect-ratio: 1;
    container-type: inline-size;
    & > * { grid-area: 1 / 1; }
    & progress {
      --value: attr(value type(<number>), 0);
      --thickness: 6.5cqi;
      appearance: none; inline-size: 100%; block-size: 100%; border: 0; border-radius: 50%;
      background: conic-gradient(var(--status) calc(var(--value) * 1%), var(--border) 0);
      mask: radial-gradient(farthest-side, transparent calc(100% - var(--thickness)), #000 calc(100% - var(--thickness) + .5px));
      transition: --value 0s;
      &::-webkit-progress-bar, &::-webkit-progress-value { background: transparent; }
      &::-moz-progress-bar { background: transparent; }
      @media (prefers-reduced-motion: no-preference) { transition-duration: .9s; transition-timing-function: cubic-bezier(.2, .7, .2, 1); }
      @starting-style { --value: 0; }
    }
  }
  .ring-c { display: grid; justify-items: center; gap: .5cqi; }
  .ring-num { font-size: 32cqi; font-weight: 650; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; }
  .ring-of { font: 6.5cqi var(--mono); color: var(--muted); }
  .grade, .badge {
    color: var(--status);
    background: color-mix(in srgb, var(--status) var(--tint), var(--surface));
    border: 1px solid color-mix(in srgb, var(--status) var(--line), var(--surface));
  }
  .grade {
    margin-block-start: 4cqi; display: inline-flex; align-items: baseline; gap: .4em; padding: .2em .8em;
    border-radius: 999px; font-size: 6cqi; font-weight: 650; letter-spacing: .08em; text-transform: uppercase;
    & b { font-size: 1.6em; letter-spacing: 0; }
  }

  .cats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 8px;
    @container report (inline-size >= 720px) { gap: 12px; }
  }
  .cat {
    container: cat / inline-size;
    display: grid; gap: 10px; padding: 14px 16px; color: var(--fg);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    &:hover { border-color: var(--border-strong); text-decoration: none; }
  }
  .cat-name { font-size: 13px; color: var(--muted); font-weight: 500; }
  .cat-score {
    font: 600 clamp(22px, 16cqi, 28px)/1 var(--mono); letter-spacing: -.03em;
    & span { color: var(--faint); font-weight: 400; }
  }
  .seg { display: flex; gap: 3px; & i { flex: 1; block-size: 6px; border-radius: 2px; background: var(--status); } }
  .cat-foot { font-size: 12px; color: var(--muted); min-block-size: 1lh; }

  .filters {
    border: 0; margin: 0; padding: 32px 0 4px; min-inline-size: 0;
    display: flex; flex-wrap: wrap; flex-wrap: balance; gap: 8px;
    @container report (inline-size < 560px) {
      flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;
      margin-inline: -16px; padding-inline: 16px; padding-block-start: 24px;
    }
  }
  .chip {
    position: relative; flex: none; display: inline-flex; align-items: center; gap: 8px;
    min-block-size: 36px; padding-inline: 14px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; font-weight: 500;
    & b { font-family: var(--mono); font-weight: 600; color: var(--fg); }
    & input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
    &:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
    &:has(:checked), .filters:not(:has(:checked)) &:first-of-type {
      background: var(--fg); border-color: var(--fg); color: var(--bg);
      & b { color: inherit; }
    }
  }

  .group { padding-block-start: 32px; scroll-margin-block-start: 16px; }
  .group-h {
    display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; margin-block-end: 10px;
    & h2 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -.01em; }
  }
  .tally { font: 13px var(--mono); color: var(--muted); }

  .list {
    container: list / inline-size;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); overflow: clip;
  }
  .row {
    display: grid; align-items: start; gap: 2px 12px; padding: 14px;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: "badge body" ". cid" "detail detail";
    &:not(:first-child) { border-block-start: 1px solid var(--border); }
    & > .badge { grid-area: badge; }
    & > .body { grid-area: body; }
    & > .cid { grid-area: cid; }
    & > .detail { grid-area: detail; }
    &.compact { padding-block: 10px; align-items: center; }
    &.compact .msg { white-space: nowrap; overflow: clip; text-overflow: ellipsis; }
    @container list (inline-size >= 560px) {
      grid-template-columns: 64px minmax(0, 1fr) auto;
      grid-template-areas: "badge body cid" ". detail detail";
      gap: 4px 16px; padding: 16px 20px;
      &.compact { padding-block: 11px; }
    }
  }
  .badge {
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    block-size: 22px; inline-size: 64px; border-radius: var(--r-badge);
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
  }
  .title {
    margin: 0; font-weight: 600; font-size: 15px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;
    .compact & { font-size: 14px; font-weight: 500; }
  }
  .tag { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding-inline: 5px; }
  .msg { margin-block-start: 2px; font-size: 14px; color: var(--muted); overflow-wrap: anywhere; }
  .cid { font: 12px var(--mono); color: var(--faint); padding-block-start: 2px; }
  .detail { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-block-start: 10px; min-inline-size: 0; }

  .fix {
    display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 14px 16px; min-inline-size: 0;
    background: var(--sunken); border: 1px solid var(--border); border-radius: var(--r-box);
    & p { font-size: 14px; line-height: 1.55; }
    & .cmd { background: var(--surface); }
  }
  .fix-h { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
  .verify { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .verify-l { font-size: 12px; color: var(--muted); font-weight: 500; }
  .fix-links { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; }

  details.ev {
    border: 1px solid var(--border); border-radius: var(--r-box); background: var(--surface);
    & summary {
      list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
      padding: 10px 14px; min-block-size: 44px; font-size: 13px; color: var(--muted);
      &::-webkit-details-marker { display: none; }
      & svg { transition: rotate .2s; }
    }
    &[open] summary svg { rotate: 90deg; }
    &::details-content {
      block-size: 0; overflow: clip;
      transition: block-size .25s ease, content-visibility .25s allow-discrete;
    }
    &[open]::details-content { block-size: auto; }
    @media (prefers-reduced-motion: reduce) { &::details-content, & summary svg { transition: none; } }
    & pre {
      margin: 0; padding: 12px 14px; overflow-x: auto; font: 12px/1.6 var(--mono);
      background: var(--sunken); border-block-start: 1px solid var(--border); border-radius: 0 0 var(--r-box) var(--r-box);
    }
  }
  .sum-k { font-weight: 600; color: var(--fg); }
  .ev-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px 14px; border-block-start: 1px solid var(--border); & .fix { padding: 12px 14px; } }
  .j-k { color: var(--accent); }
  .j-s { color: var(--pass); }
  .j-n { color: var(--warn); }

  .crawl { padding-block-start: 48px; }
  .crawl-sub { margin-block: 4px 14px; font-size: 14px; color: var(--muted); }
  .tbl-box {
    overflow-x: auto; overscroll-behavior-x: contain;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
  }
  .tbl {
    inline-size: 100%; min-inline-size: 560px; border-collapse: collapse; font-size: 14px;
    & th { text-align: start; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 12px 20px; background: var(--sunken); border-block-end: 1px solid var(--border); }
    & td { padding: 12px 20px; vertical-align: middle; }
    & tbody tr:not(:first-child) td { border-block-start: 1px solid var(--border); }
    & .num { text-align: end; font-family: var(--mono); font-variant-numeric: tabular-nums; }
  }
  .rate { display: flex; align-items: center; gap: 12px; }
  .bar {
    display: flex; block-size: 8px; inline-size: 180px; flex: none; border-radius: 4px; overflow: clip;
    background: color-mix(in srgb, var(--skip) 14%, var(--surface));
    & i { background: var(--status); }
  }
  .rate-v { font: 13px var(--mono); min-inline-size: 4ch; }


  .verdict {
    align-items: baseline; gap: 4px 10px; font-size: 15px; color: var(--muted); max-inline-size: 60ch; margin-inline: auto;
    @container report (inline-size >= 720px) { margin-inline: 0; }
    & b { color: var(--status); font-weight: 650; }
  }
  .actions {
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    @container report (inline-size >= 720px) { justify-content: start; }
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); &:hover { background: color-mix(in srgb, var(--accent), black 15%); } }

  .share {
    container: share / inline-size;
    margin-block-start: 48px; padding: 20px; display: grid; gap: 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    @container report (inline-size >= 720px) { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
    & h2 { margin: 0; font-size: 16px; font-weight: 650; }
    & p { font-size: 14px; color: var(--muted); }
  }
  .share-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .score-badge {
    display: inline-flex; align-items: stretch; border-radius: 6px; overflow: clip; font: 600 12px/1 var(--mono);
    border: 1px solid var(--border-strong);
    & span { padding: 6px 8px; background: var(--fg); color: var(--bg); }
    & b { padding: 6px 8px; color: var(--status); background: color-mix(in srgb, var(--status) var(--tint), var(--surface)); }
  }

  .viewtoggle {
    position: sticky; inset-block-end: 16px; z-index: 2; inline-size: max-content; margin: 24px auto 0; padding: 3px;
    display: flex; gap: 2px; border: 1px solid var(--border-strong); border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 85%, transparent); backdrop-filter: blur(8px);
    & label { position: relative; display: grid; place-items: center; min-block-size: 32px; padding-inline: 14px; border-radius: 999px; font: 500 13px var(--mono); color: var(--muted); cursor: pointer; }
    & input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
    & label:has(:checked), &:not(:has(:checked)) label:first-of-type { background: var(--fg); color: var(--bg); }
    & label:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
  }
  .agent-view {
    display: none; margin: 0; padding: 24px; white-space: pre-wrap; overflow-wrap: anywhere;
    font: 13px/1.7 var(--mono); color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    & .h { color: var(--accent); } & .q { color: var(--muted); }
  }

  .report-body {
    display: grid; gap: 40px;
    @container report (inline-size >= 1100px) { grid-template-columns: minmax(0, 1fr) 232px; gap: 56px; }
  }
  .checks { min-inline-size: 0; }
  .rail {
    display: none;
    @container report (inline-size >= 1100px) { display: grid; gap: 20px; position: sticky; inset-block-start: 24px; align-self: start; padding-block-start: 40px; }
    & ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; scroll-target-group: auto; border-inline-start: 1px solid var(--border); }
    & a {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; padding: 7px 12px; margin-inline-start: -1px;
      border-inline-start: 2px solid transparent; color: var(--muted); font-size: 13px;
      &:hover { color: var(--fg); text-decoration: none; }
      &:target-current { color: var(--fg); font-weight: 600; border-inline-start-color: var(--accent); }
    }
    & .n { font: 12px var(--mono); color: var(--faint); }
    & .mini { grid-column: 1 / -1; display: flex; gap: 2px; & i { flex: 1; block-size: 3px; border-radius: 1px; background: var(--status); } }
  }
  .rail-h { font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin-block-end: 8px; }
  .rail-score {
    display: grid; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: var(--r-card); background: var(--surface);
    & b { font: 650 22px/1 var(--mono); color: var(--fg); & span { color: var(--status); } }
    & p { font-size: 12px; color: var(--muted); }
  }
  .gnum { font: 600 13px var(--mono); color: var(--faint); margin-inline-end: 6px; letter-spacing: .02em; }
  .gq { margin-block: -4px 12px; font-size: 14px; color: var(--muted); }
  .probe-l {
    list-style: none; margin: 0; padding: 8px 0; font: 12px/1.5 var(--mono); border-block-start: 1px solid var(--border);
    & li { display: grid; grid-template-columns: 5ch minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 4px 14px; }
    & .m { color: var(--faint); }
    & .u { overflow-wrap: anywhere; }
    & .r { color: var(--status); font-weight: 600; white-space: nowrap; &::before { content: "\25CF  "; font-size: .8em; } }
  }

  .gain {
    font: 600 11px var(--mono); padding: 1px 7px; border-radius: 999px; letter-spacing: 0;
    color: var(--pass); background: color-mix(in srgb, var(--pass) var(--tint), var(--surface));
  }
  .how { margin-block-start: 4px; font: 12px var(--mono); color: var(--faint); }

  .foot {
    margin-block-start: 56px; padding-block: 24px 48px; border-block-start: 1px solid var(--border);
    font-size: 13px; color: var(--muted);
    & .wrap { display: grid; gap: 10px; }
  }
  .foot-links { display: flex; flex-wrap: wrap; gap: 6px 20px; }
}

@layer states {

  .ar:has(#v-agent:checked) :is(.hero, .cats, .filters, .group, .crawl, .share, .rail) { display: none; }
  .ar:has(#v-agent:checked) .agent-view { display: block; }
  .ar:has(#f-fail:checked) :is(.row:not([data-status="fail"]), .group:not(:has(.row[data-status="fail"]))),
  .ar:has(#f-warn:checked) :is(.row:not([data-status="warn"]), .group:not(:has(.row[data-status="warn"]))),
  .ar:has(#f-pass:checked) :is(.row:not([data-status="pass"]), .group:not(:has(.row[data-status="pass"]))),
  .ar:has(#f-skip:checked) :is(.row:not([data-status="skip"]), .group:not(:has(.row[data-status="skip"]))) {
    display: none;
  }
}

@layer motion {
  @keyframes ring-fill { from { --value: 0; } }
  @keyframes count-up { from { --n: 0; } }
  @keyframes rise { from { opacity: 0; translate: 0 16px; } }
  @keyframes grow { from { scale: 0 1; } }

  @media (prefers-reduced-motion: no-preference) {
    .ring progress { animation: ring-fill 1.1s cubic-bezier(.2, .7, .2, 1) both; }
    @supports (counter-reset: n attr(data-n type(<integer>), 0)) {
      .ring-num[data-n] {
        --n: attr(data-n type(<integer>), 0);
        counter-reset: n var(--n);
        animation: count-up 1.1s cubic-bezier(.2, .7, .2, 1) both;
        & span { display: none; }
        &::after { content: counter(n); }
      }
    }
    .hero > *, .cat {
      transition: opacity var(--dur-3) var(--ease-out), translate var(--dur-3) var(--ease-out), border-color var(--dur-1), box-shadow var(--dur-1);
      @starting-style { opacity: 0; translate: 0 8px; }
    }
    .hero > :nth-child(2) { transition-delay: 80ms; }
    .cat {
      transition-delay: calc(120ms + sibling-index() * 40ms);
      &:hover { box-shadow: 0 6px 18px -10px color-mix(in srgb, var(--fg) 40%, transparent); transition-delay: 0s; }
    }
    .seg i {
      transform-origin: left;
      transition: scale var(--dur-3) var(--ease-out);
      transition-delay: calc(300ms + sibling-index() * 60ms);
      @starting-style { scale: 0 1; }
    }
    .agent-view, .hero, .cats { transition: opacity var(--dur-2), display var(--dur-2) allow-discrete; @starting-style { opacity: 0; } }
    .rail a { transition: color var(--dur-1), border-color var(--dur-2) var(--ease-out); }
    .viewtoggle label { transition: background-color var(--dur-1), color var(--dur-1); }
    .chip { transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1), scale var(--dur-1); &:active { scale: .96; } }
    .btn { transition: background-color var(--dur-1), scale var(--dur-1); &:active { scale: .96; } }
    .row {
      transition: opacity var(--dur-2) var(--ease-out), translate var(--dur-2) var(--ease-out), display var(--dur-2) allow-discrete;
      @starting-style { opacity: 0; translate: 0 4px; }
    }
    @supports (animation-timeline: view()) {
      .group, .crawl {
        animation: rise linear both;
        animation-timeline: view();
        animation-range: entry 0px entry 160px;
      }
      .bar i {
        transform-origin: left;
        animation: grow linear both;
        animation-timeline: view();
        animation-range: entry 20% cover 35%;
      }
    }
  }
}

@layer print {
  @media print {
    .ar { color-scheme: light; --bg: #fff; --sunken: #fff; print-color-adjust: exact; container-type: normal; }
    .ar :where(*) { animation: none; transition: none; }
    .topbar, .filters, .btn, .viewtoggle, .agent-view, .rail, .fixdlg, .share { display: none; }
    .row, .fix, .cat, details.ev { break-inside: avoid; }
    .group-h { break-after: avoid; }
    .badge { border-width: 1.5px; }
    details.ev::details-content { block-size: auto; content-visibility: visible; }
    .fix-links a[href^="http"]::after { content: " (" attr(href) ")"; color: var(--muted); }
  }
}

@layer components {
  .ring.empty progress { background: repeating-conic-gradient(var(--border) 0 4deg, transparent 4deg 9deg); }
  .ring.empty .ring-num { color: var(--faint); }
  .fix.none { background: transparent; border-style: dashed; & .fix-h { color: var(--muted); } & p { color: var(--muted); } }
  .btn[data-copied] { color: var(--pass); border-color: color-mix(in srgb, var(--pass) var(--line), var(--surface)); }
  .ev-note { padding: 10px 14px; border-block-start: 1px solid var(--border); font-size: 13px; color: var(--muted); }

  .fixdlg {
    counter-reset: sel 0 pts var(--score, 0);
    inline-size: min(100% - 32px, 720px); max-block-size: min(100dvb - 64px, 820px); padding: 0;
    color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: clip;
    box-shadow: 0 30px 80px -20px color-mix(in srgb, black 45%, transparent);
    &[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
    &:target:not([open]) { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; position: static; margin: 32px auto; }
    &::backdrop { background: oklch(0% 0 0 / .45); }
  }
  .dlg-h {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; padding: 20px 22px 16px; border-block-end: 1px solid var(--border);
    & h2 { margin: 0; font-size: 18px; font-weight: 650; }
    & p { grid-column: 1; color: var(--muted); font-size: 14px; }
  }
  .x {
    grid-row: 1 / 3; grid-column: 2; inline-size: 36px; block-size: 36px; display: grid; place-items: center; cursor: pointer;
    border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--muted);
  }
  .dlg-b { overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding-block: 4px; }
  .fcat {
    padding: 6px 22px 8px;
    &:not(:first-child) { border-block-start: 1px solid var(--border); }
    & h3 { margin: 8px 0 4px; display: flex; justify-content: space-between; gap: 12px; font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    & h3 span { font: 500 12px var(--sans); letter-spacing: 0; text-transform: none; }
    &.bonus .pick { opacity: .8; }
  }
  .pick {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 4px 10px; min-block-size: 40px; padding-block: 4px; cursor: pointer;
    & input { inline-size: 16px; block-size: 16px; margin: 0; }
    & .t { font-weight: 500; }
    & .id { grid-column: 2; font: 12px var(--mono); color: var(--faint); }
    & .gain { grid-row: 1; grid-column: 3; }
    & input:checked { counter-increment: sel 1 pts var(--pts, 0); }
  }
  .fcat .gain[data-status="warn"] { color: var(--warn); background: color-mix(in srgb, var(--warn) var(--tint), var(--surface)); }
  details.more {
    margin: 0 0 8px 26px;
    & > summary { list-style: none; cursor: pointer; font-size: 12px; color: var(--muted); inline-size: max-content; &::-webkit-details-marker { display: none; } }
    &[open] > summary { color: var(--fg); }
  }
  .ffw {
    margin-block-start: 8px; padding: 12px 14px; display: grid; gap: 6px; font: 12px/1.6 var(--mono); overflow-wrap: anywhere;
    background: var(--sunken); border: 1px solid var(--border); border-radius: 10px;
    & b { display: inline-block; min-inline-size: 8ch; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); font-weight: 600; }
  }
  .dlg-f {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 14px 22px;
    border-block-start: 1px solid var(--border); background: var(--sunken);
  }
  .sum {
    flex: 1 1 260px; font-size: 13px; color: var(--muted);
    &::before { content: counter(sel) " of " attr(data-total) " selected \B7  "; }
    & b { font: 650 13px var(--mono); color: var(--fg); &::before { content: "score " attr(data-score) " \2192  " counter(pts); } }
  }
  details.preview {
    flex-basis: 100%; order: 3;
    & > summary { cursor: pointer; font-size: 13px; color: var(--accent); inline-size: max-content; }
    & pre { margin: 8px 0 0; max-block-size: 220px; overflow: auto; padding: 12px; font: 12px/1.6 var(--mono); white-space: pre-wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  }
  .fixdlg:not(:has(.pick :checked)) { & .sum b { display: none; } & .copy { opacity: .45; pointer-events: none; } }
}

@layer motion {
  @media (prefers-reduced-motion: no-preference) {
    .fixdlg {
      transition: opacity .3s var(--ease-out), scale .3s var(--ease-out), display .3s allow-discrete, overlay .3s allow-discrete;
      &[open] { @starting-style { opacity: 0; scale: .97; } }
    }
    .fixdlg::backdrop { transition: opacity .3s, display .3s allow-discrete, overlay .3s allow-discrete; }
    .fixdlg[open]::backdrop { @starting-style { opacity: 0; } }
  }
}
`;

// Ported from the Landing board of the design canvas. Plain CSS, no framework.
export const SITE_CSS = String.raw`
@layer tokens, base, layout, components, motion;

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
    --on-accent: oklch(100% 0 0);
    --pass: light-dark(oklch(51% .14 150), oklch(79% .16 152));
    --fail: light-dark(oklch(52% .19 30), oklch(75% .15 28));
    --warn: light-dark(oklch(50% .11 65), oklch(83% .13 85));
    --skip: light-dark(oklch(47% .03 260), oklch(74% .02 260));
    --tint: 12%;
    --line: 34%;
    --r-card: 12px;
    --r-panel: 16px;
    --r-box: 10px;
    --r-ctl: 10px;
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
  body { margin: 0; }
  .ar {
    container: page / inline-size;
    background: var(--bg); color: var(--fg); font: 16px/1.5 var(--sans);
    -webkit-font-smoothing: antialiased; min-block-size: 100dvb;
    interpolate-size: allow-keywords; accent-color: var(--accent);
    & :where(*, ::before, ::after) { box-sizing: border-box; }
    & :where(h1, h2, h3) { text-wrap: balance; margin: 0; }
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
  .wrap { max-inline-size: 1120px; margin-inline: auto; padding-inline: clamp(16px, 3cqi, 24px); }
  .block { padding-block: clamp(40px, 5cqi, 64px); }
}

@layer components {
  .nav {
    background: var(--surface); border-block-end: 1px solid var(--border);
    & .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-block-size: 60px; }
  }
  .brand { display: flex; align-items: center; gap: 10px; font: 600 15px var(--mono); & .tick { stroke: var(--accent); } }
  .nav-links {
    display: flex; align-items: center; gap: 24px; font-size: 14px;
    & a:not(.btn) { color: var(--muted); }
    @container page (inline-size < 640px) { & a:not(.btn) { display: none; } }
  }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none;
    min-block-size: 44px; padding-inline: 18px; border-radius: var(--r-ctl); cursor: pointer;
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--fg); font: 600 14px var(--sans);
    &:hover { background: var(--sunken); text-decoration: none; }
    &.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); &:hover { background: color-mix(in oklch, var(--accent), black 15%); } }
    &.sm { min-block-size: 36px; padding-inline: 12px; font-weight: 500; font-size: 13px; }
  }

  .hero {
    display: grid; justify-items: center; text-align: center; gap: 20px;
    padding-block: clamp(56px, 7cqi, 96px) clamp(40px, 4cqi, 56px);
  }
  .pill { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 4px 12px; }
  .big { font-size: clamp(38px, 5.4cqi, 64px); line-height: 1.04; letter-spacing: -.035em; font-weight: 700; max-inline-size: 18ch; }
  .lede { font-size: clamp(17px, 1.5cqi, 19px); color: var(--muted); max-inline-size: 40em; }

  .scan {
    inline-size: min(100%, 680px); margin-block-start: 8px; padding: 8px;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px;
    box-shadow: 0 1px 2px color-mix(in oklch, var(--fg) 4%, transparent), 0 10px 30px -12px color-mix(in oklch, var(--fg) 18%, transparent);
    &:has(input:focus-visible) { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 18%, transparent); }
    &:has(input:user-invalid) { border-color: var(--fail); box-shadow: 0 0 0 4px color-mix(in oklch, var(--fail) 14%, transparent); }
    & input { flex: 1 1 260px; min-inline-size: 0; min-block-size: 44px; border: 0; outline: 0; background: transparent; font: 16px var(--mono); }
    & input::placeholder { color: var(--faint); }
    @container page (inline-size < 560px) { & .btn { inline-size: 100%; } }
  }
  .scan-ic { color: var(--faint); padding-inline-start: 10px; }
  .scan-note { font-size: 13px; color: var(--muted); }
  .scan-err { display: none; font-size: 13px; color: var(--fail); }
  .hero:has(input:user-invalid) { & .scan-err { display: block; } & .scan-note { display: none; } }

  .term { inline-size: min(100%, 680px); margin-block-start: 24px; text-align: start; display: grid; gap: 8px; }
  .term-h { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; & b { font-size: 14px; } & span { font-size: 13px; color: var(--muted); } }
  .term-box, .ci-code {
    color-scheme: dark;
    background: var(--surface); color: var(--fg); border: 1px solid var(--border); border-radius: 12px;
  }
  .term-box { padding: 6px; font: 14px var(--mono); }
  .term-line {
    display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 12px;
    &:not(:first-child) { border-block-start: 1px solid var(--border); }
    & code { flex: 1; min-inline-size: 0; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
    & .pr { color: var(--faint); }
    & .c { color: var(--accent); }
    & .btn { min-block-size: 36px; padding-inline: 12px; font-weight: 500; font-size: 13px; background: var(--sunken); }
  }

  .sec-h {
    display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; margin-block-end: 20px;
    & h2 { font-size: clamp(24px, 2.4cqi, 30px); letter-spacing: -.02em; font-weight: 700; }
    & p { color: var(--muted); font-size: 15px; }
  }

  .result {
    container: result / inline-size;
    display: grid; gap: 24px; padding: clamp(16px, 2.4cqi, 28px);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-panel);
  }
  .res-top {
    display: grid; justify-items: center; text-align: center; gap: 20px;
    @container result (inline-size >= 640px) { grid-template-columns: auto minmax(0, 1fr); justify-items: start; text-align: start; align-items: center; column-gap: 36px; }
  }
  .res-meta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-inline-size: 0; }
  .res-target { font: 600 clamp(18px, 3.4cqi, 22px) var(--mono); overflow-wrap: anywhere; & span { color: var(--faint); font-weight: 400; } }
  .res-sub { font-size: 14px; color: var(--muted); }
  .res-actions {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
    @container result (inline-size >= 640px) { justify-content: start; }
  }

  .ring {
    display: grid; place-items: center; inline-size: 140px; aspect-ratio: 1; container-type: inline-size;
    & > * { grid-area: 1 / 1; }
    & progress {
      --value: attr(value type(<number>), 0);
      --thickness: 7cqi;
      appearance: none; inline-size: 100%; block-size: 100%; border: 0; border-radius: 50%;
      background: conic-gradient(var(--status) calc(var(--value) * 1%), var(--border) 0);
      mask: radial-gradient(farthest-side, transparent calc(100% - var(--thickness)), #000 calc(100% - var(--thickness) + .5px));
      &::-webkit-progress-bar, &::-webkit-progress-value { background: transparent; }
      &::-moz-progress-bar { background: transparent; }
    }
  }
  .ring-c { display: grid; justify-items: center; gap: .5cqi; }
  .ring-num { font-size: 32cqi; font-weight: 650; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; }
  .ring-of { font: 7cqi var(--mono); color: var(--muted); }
  .grade, .badge {
    color: var(--status);
    background: color-mix(in oklch, var(--status) var(--tint), var(--surface));
    border: 1px solid color-mix(in oklch, var(--status) var(--line), var(--surface));
  }
  .grade {
    margin-block-start: 4cqi; display: inline-flex; align-items: baseline; gap: .4em; padding: .2em .8em;
    border-radius: 999px; font-size: 7cqi; font-weight: 650; letter-spacing: .08em; text-transform: uppercase;
    & b { font-size: 1.5em; letter-spacing: 0; }
  }

  .cats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px; }
  .cat {
    container: cat / inline-size; display: grid; gap: 10px; padding: 14px 16px;
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-card);
  }
  .cat-name { font-size: 13px; color: var(--muted); font-weight: 500; }
  .cat-score { font: 600 clamp(20px, 16cqi, 26px)/1 var(--mono); letter-spacing: -.03em; & span { color: var(--faint); font-weight: 400; } }
  .seg { display: flex; gap: 3px; & i { flex: 1; block-size: 6px; border-radius: 2px; background: var(--status); } }

  .topfix { display: grid; gap: 4px; padding-block-start: 20px; border-block-start: 1px solid var(--border); }
  .topfix-h { font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-block-end: 6px; }
  .fixrow {
    display: grid; align-items: center; gap: 4px 14px; padding-block: 10px;
    grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "badge title" ". msg" ". link";
    &:not(:nth-child(2)) { border-block-start: 1px dashed var(--border); }
    & .badge { grid-area: badge; } & b { grid-area: title; font-weight: 600; } & .m { grid-area: msg; color: var(--muted); font-size: 14px; } & a { grid-area: link; font-size: 14px; }
    @container result (inline-size >= 760px) {
      grid-template-columns: 64px minmax(0, 18rem) minmax(0, 1fr) auto; grid-template-areas: "badge title msg link";
    }
  }
  .badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; block-size: 22px; inline-size: 64px; border-radius: var(--r-badge); font-size: 11px; font-weight: 700; letter-spacing: .06em; }


  .pillars {
    container: pillars / inline-size;
    display: grid; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-panel); overflow: clip;
    @container page (inline-size >= 900px) { grid-template-columns: minmax(0, 340px) minmax(0, 1fr); }
  }
  .tabs {
    border: 0; margin: 0; padding: 0; min-inline-size: 0; display: flex; overflow-x: auto; scrollbar-width: none;
    border-block-end: 1px solid var(--border);
    @container page (inline-size >= 900px) { flex-direction: column; overflow: visible; border-block-end: 0; border-inline-end: 1px solid var(--border); }
  }
  .tab {
    position: relative; flex: none; display: grid; gap: 2px; padding: 14px 18px; cursor: pointer; color: var(--muted);
    border-inline-start: 2px solid transparent;
    & input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: inherit; }
    & .tab-q { display: none; font-size: 13px; }
    &:not(:first-of-type) { border-block-start: 1px solid transparent; }
    &:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: -2px; }
    &:has(:checked), .tabs:not(:has(:checked)) &:first-of-type {
      color: var(--fg); background: var(--sunken); border-inline-start-color: var(--accent);
      & .tab-n { color: var(--accent); }
    }
    @container page (inline-size >= 900px) {
      padding: 18px 22px;
      &:not(:first-of-type) { border-block-start-color: var(--border); }
      & .tab-q { display: block; }
    }
  }
  .tab-n { font: 600 11px var(--mono); letter-spacing: .06em; color: var(--faint); }
  .tab-t { font-weight: 650; font-size: 15px; }
  .panels { display: grid; min-inline-size: 0; }
  .panel {
    grid-area: 1 / 1; display: grid; gap: 18px; align-content: start; padding: clamp(18px, 3cqi, 32px);
    .pillars:has(:checked) &, &:not(:first-of-type) { display: none; }
  }
  .pillars:has(#p1:checked) .panel[data-p="1"], .pillars:has(#p2:checked) .panel[data-p="2"],
  .pillars:has(#p3:checked) .panel[data-p="3"], .pillars:has(#p4:checked) .panel[data-p="4"],
  .pillars:has(#p5:checked) .panel[data-p="5"] { display: grid; }
  .panel-h { display: grid; gap: 6px; & h3 { font-size: clamp(20px, 2.6cqi, 26px); letter-spacing: -.02em; } & p { color: var(--muted); max-inline-size: 56ch; } }
  .probe {
    color-scheme: dark; background: var(--surface); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; overflow: clip;
  }
  .probe-h { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-block-end: 1px solid var(--border); font: 12px var(--mono); color: var(--muted); }
  .dots { display: flex; gap: 6px; & i { inline-size: 9px; block-size: 9px; border-radius: 50%; background: var(--border-strong); } }
  .probe-l {
    list-style: none; margin: 0; padding: 8px 0; font: 13px/1.5 var(--mono);
    & li { display: grid; grid-template-columns: 5ch minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 6px 14px; }
    & .m { color: var(--faint); }
    & .u { overflow-wrap: anywhere; }
    & .r { color: var(--status); font-weight: 600; white-space: nowrap; &::before { content: "\25CF  "; font-size: .8em; } }
  }
  .panel-ids { font: 12px var(--mono); color: var(--faint); & span { font-family: var(--sans); font-weight: 650; letter-spacing: .06em; text-transform: uppercase; font-size: 11px; color: var(--muted); margin-inline-end: 8px; } }

  .ci {
    display: grid; gap: 24px; align-items: center;
    @container page (inline-size >= 960px) { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; }
  }
  .ci-copy {
    display: grid; gap: 12px;
    & h2 { font-size: clamp(24px, 2.4cqi, 30px); letter-spacing: -.02em; }
    & p { color: var(--muted); }
    & ul { margin: 0; padding-inline-start: 18px; color: var(--muted); font-size: 15px; display: grid; gap: 6px; }
  }
  .ci-code {
    margin: 0; padding: 20px 22px; font: 13px/1.75 var(--mono); white-space: pre; overflow-x: auto;
    & .cm { color: var(--faint); } & .c { color: var(--accent); } & .s { color: var(--pass); }
  }

  .foot {
    border-block-start: 1px solid var(--border); padding-block: 28px 48px; font-size: 13px; color: var(--muted);
    & .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
  }
  .foot-links { display: flex; flex-wrap: wrap; gap: 8px 20px; }
}

@layer motion {
  @keyframes ring-fill { from { --value: 0; } }
  @keyframes count-up { from { --n: 0; } }
  @view-transition { navigation: auto; }
  .ring { view-transition-name: score-ring; }
  @keyframes rise { from { opacity: 0; translate: 0 20px; } }
  @keyframes fill { from { --value: 0; } }
  @keyframes caret { 50% { opacity: 0; } }

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
    .hero > * {
      transition: opacity .6s var(--ease-out), translate .6s var(--ease-out);
      transition-delay: calc(sibling-index() * 70ms);
      @starting-style { opacity: 0; translate: 0 12px; }
    }
    .scan { transition: border-color var(--dur-1), box-shadow var(--dur-2) var(--ease-out), opacity .6s var(--ease-out), translate .6s var(--ease-out); transition-delay: 0s, 0s, 280ms, 280ms; }
    .btn { transition: background-color var(--dur-1), scale var(--dur-1); &:active { scale: .97; } }
    .panel {
      transition: opacity var(--dur-3) var(--ease-out), translate var(--dur-3) var(--ease-out), display var(--dur-3) allow-discrete;
      @starting-style { opacity: 0; translate: 12px 0; }
    }
    .probe-l li {
      transition: opacity .3s var(--ease-out), translate .3s var(--ease-out);
      transition-delay: calc(150ms + sibling-index() * 90ms);
      @starting-style { opacity: 0; translate: 0 4px; }
    }
    .tab { transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-2); }
    .term-line:last-child code::after {
      content: ""; display: inline-block; inline-size: .55em; block-size: 1.1em; vertical-align: -.2em;
      margin-inline-start: 3px; background: var(--accent); animation: caret 1.1s steps(1) infinite;
    }
    @supports (animation-timeline: view()) {
      .result, .ci > * {
        animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 40%;
      }
      .ring progress {
        animation: fill linear both; animation-timeline: view(); animation-range: entry 30% cover 45%;
      }
      .ring-num[data-n] {
        animation: count-up linear both; animation-timeline: view(); animation-range: entry 30% cover 45%;
      }
      .pillars { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
    }
  }
}

@layer components {
  .btn[data-copied] { color: var(--pass); }
  .ar a.brand { color: var(--fg); &:hover { text-decoration: none; } }
  .term-line .btn[data-copied] { color: var(--pass); }
  .scan-page { display: grid; justify-items: center; text-align: center; gap: 18px; padding-block: clamp(56px, 8cqi, 104px); }
  .scan-page .term { margin-block-start: 8px; }
  .scan-page .lede { max-inline-size: 46ch; }
  .back { font-size: 14px; }
}

@layer components {
  /* Single-column grids size their track to the widest child (nowrap commands); clamp it. */
  :is(.hero, .scan-page, .term, .result, .ci, .ci-copy, .panel, .panel-h) { grid-template-columns: minmax(0, 1fr); }
  .res-top { grid-template-columns: minmax(0, 1fr); @container result (inline-size >= 640px) { grid-template-columns: auto minmax(0, 1fr); } }
  .ci { @container page (inline-size >= 960px) { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); } }
  :where(.hero, .scan-page) > * { max-inline-size: 100%; }
}
`;

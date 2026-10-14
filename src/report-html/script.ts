// Inline, dependency-free behavior for the HTML report. Everything works without it
// (filters, evidence, agent view are CSS-only); this adds copy, print and Fix with AI.
export const REPORT_JS = String.raw`(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    const label = btn.querySelector('[data-label]') || btn;
    const before = label.textContent;
    btn.dataset.copied = '';
    label.textContent = 'Copied';
    setTimeout(() => {
      delete btn.dataset.copied;
      label.textContent = before;
    }, 1500);
  }

  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', () => copy(btn.dataset.copy, btn)));
  window.addEventListener('beforeprint', () => $$('details.ev').forEach((d) => { d.open = true; }));

  const dlg = $('#fix');
  const dataEl = $('#fix-data');
  if (!dlg || !dataEl || typeof dlg.showModal !== 'function') return;
  const data = JSON.parse(dataEl.textContent);
  const boxes = $$('input[name="fix"]', dlg);

  function prompt() {
    const picked = boxes.filter((b) => b.checked).map((b) => b.value);
    const items = picked.map((id, n) => {
      const f = data.checks[id];
      const lines = [(n + 1) + '. ' + f.title + ' (' + id + ')', '   Finding: ' + f.finding];
      if (f.fix) lines.push('   Fix: ' + f.fix);
      if (f.verify) lines.push('   Verify: ' + f.verify);
      if (f.prompt) lines.push('   Detailed guide: ' + f.prompt + ' in the agent-readiness package');
      if (f.spec) lines.push('   Spec: ' + f.spec);
      return lines.join('\n');
    });
    return [
      'Fix these agent-readiness findings on ' + data.target + '.',
      'Apply each fix, then run its verify command and confirm it passes.',
      '',
      ...items,
    ].join('\n');
  }

  function update() {
    const p = prompt();
    $('.preview pre', dlg).textContent = p;
    $('.tokens', dlg).textContent = boxes.some((b) => b.checked) ? ' \u00b7 ~' + Math.ceil(p.length / 4) + ' tokens' : '';
  }

  $$('[data-open-fix]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const only = a.dataset.openFix;
    boxes.forEach((b) => { b.checked = only ? b.value === only : !b.hasAttribute('data-bonus'); });
    update();
    dlg.showModal();
  }));
  dlg.addEventListener('change', update);
  $('.x', dlg).addEventListener('click', (e) => { e.preventDefault(); dlg.close(); });
  $('.copy', dlg).addEventListener('click', (e) => copy(prompt(), e.currentTarget));
})();`;

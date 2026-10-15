// Site-only behavior, appended to the report script in /assets/site.js.
// The pillar tabs work without it (radios + :has()); this wraps a click in a
// same-document view transition and keeps the active tab scrolled into view.
export const SITE_JS = String.raw`(() => {
  const tabs = document.querySelector('.tabs');
  if (!tabs) return;
  const radios = [...tabs.querySelectorAll('input[name="pillar"]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const reveal = (input) => input.closest('.tab').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  tabs.addEventListener('change', (e) => reveal(e.target));

  if (typeof document.startViewTransition !== 'function') return;

  tabs.addEventListener('click', (e) => {
    const label = e.target.closest('.tab');
    const input = label && label.querySelector('input');
    // Keyboard selection checks the radio before click fires; leave it to the CSS fallback.
    if (!input || input.checked || reduce.matches) return;
    e.preventDefault();
    const from = Math.max(radios.findIndex((r) => r.checked), 0);
    const direction = radios.indexOf(input) > from ? 'forward' : 'backward';
    const update = () => {
      input.checked = true;
      input.focus({ preventScroll: true });
      reveal(input);
    };
    try {
      document.startViewTransition({ update, types: ['pillar', direction] });
    } catch {
      document.startViewTransition(update);
    }
  });
})();`;

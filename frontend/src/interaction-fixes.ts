// Small interaction guardrails for the demo UI. Keeps every visible navigation target actionable.
export function installInteractionFixes() {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('a');
    if (!link) return;
    const label = link.textContent?.trim() || '';
    if (!label.startsWith('Planning Queue')) return;

    const overview = Array.from(document.querySelectorAll('nav a')).find((a) =>
      a.textContent?.trim().startsWith('Overview')
    ) as HTMLElement | undefined;
    if (overview) {
      event.preventDefault();
      overview.click();
      window.setTimeout(() => document.querySelector('.request-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  });
}

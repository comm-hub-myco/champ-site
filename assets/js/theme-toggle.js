(function () {
  const STORAGE_KEY = 'champ.theme';
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');

  if (!toggle) return;

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      toggle.setAttribute('aria-pressed', 'true');
      toggle.querySelector('.theme-toggle-label').textContent = 'Light';
    } else {
      root.removeAttribute('data-theme');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.querySelector('.theme-toggle-label').textContent = 'Dark';
    }
  }

  // Determine initial theme
  const stored = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const initialTheme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);

  toggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  });
})();

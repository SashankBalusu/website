const root = document.documentElement;
const toggles = document.querySelectorAll('[data-theme-toggle]');
const followsSystem = root.dataset.themeMode === 'system';
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let chosenTheme = null;
if (followsSystem) {
  try {
    const saved = localStorage.getItem('site-theme');
    if (saved === 'light' || saved === 'dark') chosenTheme = saved;
  } catch { /* Follow the system when storage is unavailable. */ }
}

function setTheme(theme) {
  const light = theme === 'light';
  root.dataset.theme = light ? 'light' : 'dark';
  if (!followsSystem) {
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* Storage can be disabled. */ }
  }
  toggles.forEach(button => {
    button.setAttribute('aria-pressed', String(!light));
    button.setAttribute('aria-label', light ? 'Switch to night mode' : 'Switch to day mode');
    button.title = light ? 'Switch to night mode' : 'Switch to day mode';
    const label = button.querySelector('[data-theme-label]');
    if (label) label.textContent = button.hasAttribute('data-theme-plain')
      ? (light ? 'Night' : 'Day')
      : (light ? 'Night game' : 'Day game');
  });
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: root.dataset.theme } }));
}

function toggleTheme() {
  const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
  if (followsSystem) {
    chosenTheme = nextTheme;
    try { localStorage.setItem('site-theme', chosenTheme); } catch { /* Keep the choice for this page. */ }
  }
  setTheme(nextTheme);
}
document.addEventListener('themetoggle', toggleTheme);
toggles.forEach(button => button.addEventListener('click', toggleTheme));

if (followsSystem) {
  const syncSystemTheme = () => setTheme(chosenTheme || (systemTheme.matches ? 'dark' : 'light'));
  syncSystemTheme();
  systemTheme.addEventListener('change', syncSystemTheme);
} else {
  let initialTheme = 'light';
  try { initialTheme = localStorage.getItem('theme') || initialTheme; } catch { /* Use the default. */ }
  setTheme(initialTheme);
}

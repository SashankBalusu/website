const root = document.documentElement;
const toggles = document.querySelectorAll('[data-theme-toggle]');

function setTheme(theme) {
  const light = theme === 'light';
  root.dataset.theme = light ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* Storage can be disabled. */ }
  toggles.forEach(button => {
    button.setAttribute('aria-pressed', String(!light));
    button.setAttribute('aria-label', light ? 'Switch to night mode' : 'Switch to day mode');
    button.title = light ? 'Switch to night mode' : 'Switch to day mode';
    const label = button.querySelector('[data-theme-label]');
    if (label) label.textContent = light ? 'Night game' : 'Day game';
  });
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: root.dataset.theme } }));
}

let initialTheme = 'light';
try { initialTheme = localStorage.getItem('theme') || initialTheme; } catch { /* Use the default. */ }
setTheme(initialTheme);
toggles.forEach(button => button.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light')));

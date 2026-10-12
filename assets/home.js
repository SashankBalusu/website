const mark = document.querySelector('[data-ribbon]');
const home = document.querySelector('.home-view');
const ribbon = document.querySelector('.ribbon-center');
const infoView = document.getElementById('info');
const infoTitle = document.getElementById('info-title');
const infoLink = document.querySelector('.info-link');

function toggleTheme() {
  document.dispatchEvent(new CustomEvent('themetoggle'));
}

function updateMarkLabel() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  mark.setAttribute('aria-label', `Send a charge to switch to ${nextTheme} mode`);
}
updateMarkLabel();
document.addEventListener('themechange', updateMarkLabel);
mark.addEventListener('click', () => {
  // The still mark remains a working theme switch if WebGL is unavailable.
  if (mark.dataset.ready !== 'true') toggleTheme();
});

function setInfoExpanded(open, focus = true) {
  home.dataset.infoOpen = String(open);
  infoView.inert = !open;
  infoView.setAttribute('aria-hidden', String(!open));
  ribbon.inert = open;
  ribbon.setAttribute('aria-hidden', String(open));
  infoLink.setAttribute('aria-expanded', String(open));
  infoLink.textContent = open ? 'Back' : 'Info';
  if (!open && location.hash === '#info') history.replaceState(null, '', location.pathname + location.search);
  if (focus) (open ? infoTitle : infoLink).focus({ preventScroll: true });
}
infoLink.addEventListener('click', () => setInfoExpanded(home.dataset.infoOpen !== 'true'));
document.addEventListener('click', event => {
  if (home.dataset.infoOpen !== 'true' || event.target.closest('a, button')) return;
  setInfoExpanded(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && home.dataset.infoOpen === 'true') {
    event.preventDefault();
    setInfoExpanded(false);
  }
});

if (location.hash === '#info') setInfoExpanded(true, false);
window.addEventListener('hashchange', () => setInfoExpanded(location.hash === '#info'));

let loaded = false;
async function loadRibbon() {
  if (loaded) return;
  loaded = true;
  try {
    const { mountRibbon } = await import('./ribbon.js?v=no-hover-1');
    mountRibbon(mark, { onChargeComplete: toggleTheme });
  } catch (error) {
    console.warn('Using the still ribbon mark.', error);
  }
}
if ('requestIdleCallback' in window) requestIdleCallback(loadRibbon, { timeout: 1000 });
else requestAnimationFrame(loadRibbon);

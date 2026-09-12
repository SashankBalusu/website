import { DEFAULT_SETTINGS, PREVIEW_KEY, loadSiteSettings, parsePreset } from './stadium-settings.js';

const figure = document.getElementById('stadium-preview');

// The page and theme switch remain usable if 3D is unavailable.
function showFallback() {
  figure.dataset.ready = 'false';
  figure.querySelector('.stadium-hint').textContent = 'SoFi Stadium · Bolt Up';
  figure.querySelector('[data-scene-status]').textContent = 'Showing a still view of the stadium.';
  figure.querySelectorAll('[data-scene-action]').forEach(button => { button.disabled = true; });
}

let loading;
function loadStadium() {
  loading ||= mount();
  return loading;
}
async function mount() {
  try {
    const { mountStadium } = await import('./stadium.js');
    let settings = DEFAULT_SETTINGS;
    try { settings = await loadSiteSettings(); }
    catch (error) { console.warn('Using the default stadium preset:', error); }
    if (new URLSearchParams(location.search).get('stadium-preview') === '1') {
      try {
        const saved = localStorage.getItem(PREVIEW_KEY);
        if (saved) {
          settings = parsePreset(saved).settings;
          const notice = document.createElement('a');
          notice.href = './stadium-editor.html';
          notice.textContent = 'Local draft preview · back to editor';
          notice.className = 'stadium-preview-notice';
          figure.querySelector('figcaption').prepend(notice);
        }
      } catch (error) { console.warn('Draft preview unavailable:', error); }
    }
    await mountStadium(figure, showFallback, { settings, presentation: 'homepage' });
  } catch (error) {
    console.warn('Stadium preview unavailable:', error);
    showFallback();
  }
}

// The homepage shows one permanent desktop model. Match the CSS breakpoint so
// phones never import Three.js or create a hidden WebGL scene. If the viewport
// grows, the now-visible figure intersects and loads normally. Once mounted,
// the renderer's own visibility observer pauses it when the figure is hidden.
const desktop = matchMedia('(min-width: 1051px)');
const observer = new IntersectionObserver(entries => {
  if (!desktop.matches || !entries.some(entry => entry.isIntersecting)) return;
  observer.disconnect(); loadStadium();
}, { rootMargin: '200px' });
observer.observe(figure);

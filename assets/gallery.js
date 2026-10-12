const field = document.getElementById('photo-field');
const dialog = document.getElementById('lightbox');
const stage = document.getElementById('viewer-stage');
const count = document.getElementById('viewer-count');
const caption = document.getElementById('viewer-caption');
const config = window.GALLERY_CONFIG || {};
const names = config.imageOrder || [];
const pad = number => String(number).padStart(2, '0');

// Each pair shares a row, with independent widths and vertical offsets.
// The spaces between them stay in normal document flow at every screen size.
const positions = [
  { row: 1, column: 2, span: 7, offset: '0vw', mobile: 72, align: 'flex-start', ratio: 4 / 5 },
  { row: 1, column: 12, span: 13, offset: '9vw', mobile: 100, align: 'flex-end' },
  { row: 2, column: 1, span: 9, offset: '0vw', mobile: 78, align: 'flex-start' },
  { row: 2, column: 15, span: 10, offset: '8vw', mobile: 86, align: 'flex-end' },
  { row: 3, column: 5, span: 16, offset: '1vw', mobile: 100, align: 'center' },
  { row: 4, column: 1, span: 12, offset: '7vw', mobile: 88, align: 'flex-start' },
  { row: 4, column: 18, span: 7, offset: '0vw', mobile: 64, align: 'flex-end' },
  { row: 5, column: 11, span: 14, offset: '0vw', mobile: 100, align: 'flex-end' },
  { row: 5, column: 2, span: 6, offset: '10vw', mobile: 64, align: 'flex-start' },
  { row: 6, column: 13, span: 11, offset: '7vw', mobile: 88, align: 'flex-end' },
  { row: 6, column: 1, span: 8, offset: '0vw', mobile: 78, align: 'flex-start' },
  { row: 7, column: 7, span: 17, offset: '1vw', mobile: 100, align: 'center' },
  { row: 8, column: 3, span: 7, offset: '0vw', mobile: 64, align: 'flex-start', ratio: 2 / 3 },
  { row: 8, column: 12, span: 13, offset: '11vw', mobile: 94, align: 'flex-end' },
];

const descriptions = {
  'drone19.JPG': 'Sutro Tower rising above a blanket of fog at dusk',
  'drone18.JPG': 'The Golden Gate Bridge and layers of coastal hills at sunset',
  'drone16.JPG': 'San Francisco stretching toward the horizon at dusk',
  'drone15.JPG': 'A golden sunset over the rooftops of San Francisco',
  'A4F8DACB-DC46-44B3-8678-078CA15DAB47_1_105_c.jpg': 'San Francisco and the bay beneath a cloudy sky',
  'drone4.JPG': 'A packed Fenway Park during a night game',
  'drone11.JPG': 'A copper dome surrounded by ivy and city buildings in Boston',
  'drone1.JPG': 'Fenway Park and the illuminated Citgo sign at night',
  'drone9.JPG': 'A glowing gold dome above Boston at night',
  'drone2.JPG': 'Boston neighborhoods and distant towers at blue hour',
  '7F5A1F31-5964-4DEA-A604-BC649BF3FF45_1_105_c.jpg': 'Boston towers under a deep blue sky',
  'DJI_20250808200349_0088_D.jpg': 'The MIT campus across the Charles River at sunset',
  '166D8B8A-5764-4B92-BBCD-5778F2DD8787_1_105_c.jpg': 'The Berkeley Campanile illuminated above the city at night',
  'A917B8B8-2941-4E91-8E39-62AD3AA485A0_1_105_c.jpg': 'The circular Apple Park building at dusk',
};

let drafts = {};
try {
  const saved = JSON.parse(localStorage.getItem('galleryCropDraftV2') || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) drafts = saved;
} catch { /* A missing or invalid editor draft must not prevent browsing. */ }

let metadata = {};
try {
  const response = await fetch('assets/imageMeta.json');
  if (response.ok) metadata = await response.json();
} catch { /* The gallery can render without optional image metadata. */ }

const photos = names.map((name, index) => {
  const crop = { ...(config.cropByImage?.[name] || {}), ...(drafts[name] || {}) };
  return {
    name, index, crop,
    city: crop.city || config.cityByImage?.[name] || '',
    description: descriptions[name] || `Photograph ${index + 1}`,
    meta: metadata[name] || { w: 1600, h: 1066 },
    position: positions[index % positions.length],
  };
});

function imagePath(photo, width, extension) {
  return `assets/thumbs/${width}w/${encodeURIComponent(photo.name)}.${extension}`;
}

function makePicture(photo, expanded = false) {
  const picture = document.createElement('picture');
  const widths = [480, 960, 1600];
  const srcset = extension => widths.map(width => `${imagePath(photo, width, extension)} ${Math.min(width, photo.meta.w)}w`).join(', ');
  // A tall crop needs enough source pixels for its height as well as its width.
  const cropScale = photo.position.ratio ? Math.max(1, photo.meta.w / photo.meta.h / photo.position.ratio) : 1;
  const desktopWidth = Math.round(photo.position.span / 24 * 92 * cropScale);
  const mobileWidth = photo.position.mobile * cropScale;
  const sizes = expanded
    ? `(max-width: 650px) min(calc(100vw - 36px), calc((100dvh - 144px) * ${photo.meta.w / photo.meta.h})), min(92vw, calc((100dvh - 168px) * ${photo.meta.w / photo.meta.h}))`
    : `(max-width: 650px) calc((100vw - 44px) * ${mobileWidth / 100}), (min-width: 1568px) ${Math.round(1440 * photo.position.span / 24 * cropScale)}px, ${desktopWidth}vw`;
  for (const extension of ['avif', 'webp']) {
    const source = document.createElement('source');
    source.type = `image/${extension}`;
    source.srcset = srcset(extension);
    source.sizes = sizes;
    picture.append(source);
  }
  const img = document.createElement('img');
  img.width = photo.meta.w;
  img.height = photo.meta.h;
  img.alt = photo.description;
  img.sizes = sizes;
  img.srcset = srcset('jpg');
  img.src = imagePath(photo, 960, 'jpg');
  img.loading = expanded || photo.index < 2 ? 'eager' : 'lazy';
  img.decoding = 'async';
  if (expanded || photo.index === 0) img.fetchPriority = 'high';
  if (photo.meta.lqip) img.style.background = `url("${photo.meta.lqip}") center / ${expanded ? 'contain' : 'cover'} no-repeat`;
  picture.append(img);
  return picture;
}

function makePhoto(photo) {
  const figure = document.createElement('figure');
  figure.className = 'photo';
  const { position, crop } = photo;
  const properties = {
    '--row': position.row + Math.floor(photo.index / positions.length) * 8,
    '--column': position.column,
    '--span': position.span,
    '--offset': position.offset,
    '--ratio': position.ratio || `${photo.meta.w} / ${photo.meta.h}`,
    '--mobile-width': `${position.mobile}%`,
    '--mobile-align': position.align,
    '--crop-x': `${Number.isFinite(crop.x) ? crop.x : 50}%`,
    '--crop-y': `${Number.isFinite(crop.y) ? crop.y : 50}%`,
  };
  Object.entries(properties).forEach(([name, value]) => figure.style.setProperty(name, value));
  const link = document.createElement('a');
  link.className = 'photo-link';
  link.href = imagePath(photo, 1600, 'jpg');
  link.setAttribute('aria-label', `Open photo ${pad(photo.index + 1)}: ${photo.description}`);
  link.setAttribute('aria-haspopup', 'dialog');
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openViewer(photo.index, link);
  });
  const frame = document.createElement('span');
  frame.className = 'photo-frame';
  frame.append(makePicture(photo));
  link.append(frame);
  const label = document.createElement('figcaption');
  const number = document.createElement('span');
  number.className = 'photo-number';
  number.textContent = pad(photo.index + 1);
  const city = document.createElement('span');
  city.textContent = photo.city;
  label.append(number, city);
  figure.append(link, label);
  return figure;
}

let currentIndex = 0;
let opener;
let returnScroll = { x: 0, y: 0 };
let touchStart;

function showPhoto(index) {
  currentIndex = (index + photos.length) % photos.length;
  const photo = photos[currentIndex];
  stage.replaceChildren(makePicture(photo, true));
  count.textContent = `${pad(currentIndex + 1)} / ${pad(photos.length)}`;
  caption.textContent = photo.city === 'SF' ? 'San Francisco' : photo.city;
}

function openViewer(index, trigger) {
  opener = trigger;
  returnScroll = { x: window.scrollX, y: window.scrollY };
  showPhoto(index);
  document.documentElement.dataset.viewerOpen = '';
  dialog.showModal();
}

function closeViewer() {
  if (dialog.open) dialog.close();
}

document.getElementById('viewer-close').addEventListener('click', closeViewer);
document.getElementById('viewer-prev').addEventListener('click', () => showPhoto(currentIndex - 1));
document.getElementById('viewer-next').addEventListener('click', () => showPhoto(currentIndex + 1));
dialog.addEventListener('close', () => {
  delete document.documentElement.dataset.viewerOpen;
  touchStart = null;
  opener?.focus({ preventScroll: true });
  window.scrollTo(returnScroll.x, returnScroll.y);
});
dialog.addEventListener('click', event => {
  if (event.target === dialog || event.target === stage) closeViewer();
});
dialog.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  showPhoto(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
});
stage.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
stage.addEventListener('touchend', event => {
  if (!touchStart || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(currentIndex + (dx < 0 ? 1 : -1));
}, { passive: true });
stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

field.replaceChildren(...photos.map(makePhoto));

import { FIELDS, DEFAULT_SETTINGS, DRAFT_KEY, PREVIEW_KEY, LIBRARY_KEY,
  normalizeSettings, parsePreset, preset, loadSiteSettings } from './stadium-settings.js';

const $ = selector => document.querySelector(selector);
const figure = $('.stadium-scene');
const message = $('#editor-message');
const fields = new Map();
let engine, settings = { ...DEFAULT_SETTINGS }, siteSettings = { ...DEFAULT_SETTINGS };
let history = [], historyIndex = 0, comparing = false, applyTimer = 0, saveTimer = 0;
let library = [], renderVersion = 0;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function say(text, error = false) { message.textContent = text; message.dataset.error = String(error); }
function storageRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageWrite(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { $('#save-state').textContent = 'Not saved · export a preset to keep it'; return false; }
}
function saveDraft() {
  clearTimeout(saveTimer);
  const ok = storageWrite(DRAFT_KEY, JSON.stringify(preset(settings, $('#preset-name').value)));
  if (ok) $('#save-state').textContent = 'Draft saved on this browser';
  return ok;
}
function scheduleSave() {
  $('#save-state').textContent = 'Saving your draft…';
  clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 350);
}
function create(tag, attributes = {}, text) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
function refreshControls() {
  for (const field of FIELDS) {
    for (const input of fields.get(field.key) || []) input.value = settings[field.key];
  }
  $('#undo').disabled = !engine || historyIndex === 0;
  $('#redo').disabled = !engine || historyIndex === history.length - 1;
  $('#compare').setAttribute('aria-pressed', String(comparing));
  $('#compare').textContent = comparing ? 'Back to my draft' : 'Compare with site';
  const unavailable = !engine || figure.dataset.ready !== 'true';
  document.querySelectorAll('.parameter-fields').forEach(fieldset => { fieldset.disabled = unavailable || comparing; });
  document.querySelectorAll('[data-view], #compare, #export-poster').forEach(button => { button.disabled = unavailable; });
}
function applyNow() {
  clearTimeout(applyTimer); applyTimer = 0;
  if (!engine || figure.dataset.ready !== 'true') return false;
  try {
    engine.updateSettings(comparing ? siteSettings : settings);
    figure.dataset.renderVersion = String(++renderVersion);
    const visible = comparing ? siteSettings : settings;
    $('#scene-stats').textContent = `${visible.sideColumns * 2 + visible.frontColumns} columns · ${comparing ? 'Site preset' : 'Your local draft'}`;
    return true;
  } catch (error) { say(`Couldn’t update the model: ${error.message}`, true); return false; }
}
function scheduleApply() {
  // Coalesce fast slider events, but keep rendering during a continuous drag.
  if (!applyTimer) applyTimer = setTimeout(applyNow, 70);
}
function commit() {
  if (equal(settings, history[historyIndex])) return;
  history = history.slice(0, historyIndex + 1);
  history.push({ ...settings });
  if (history.length > 80) history.shift();
  historyIndex = history.length - 1;
  refreshControls();
}
function replaceSettings(next, text) {
  comparing = false; settings = normalizeSettings(next);
  commit(); refreshControls(); applyNow(); scheduleSave(); say(text);
}
function changeField(field, raw) {
  try {
    settings = normalizeSettings({ ...settings, [field.key]: field.type === 'color' ? raw : Number(raw) });
    for (const input of fields.get(field.key)) input.value = settings[field.key];
    scheduleApply(); scheduleSave();
  } catch (error) { refreshControls(); say(error.message, true); }
}

const groups = [...new Set(FIELDS.filter(field => !field.hidden).map(field => field.group))];
for (const [index, group] of groups.entries()) {
  const details = create('details', { class: 'control-group' });
  if (index === 0) details.open = true;
  const summary = create('summary');
  summary.append(create('span', { class: 'group-number' }, String(index + 1).padStart(2, '0')), document.createTextNode(group));
  const content = create('div', { class: 'group-content' });
  const fieldset = create('fieldset', { class: 'parameter-fields', disabled: '', 'aria-label': group });
  for (const field of FIELDS.filter(item => !item.hidden && item.group === group)) {
    const row = create('div', { class: 'parameter' });
    const top = create('div', { class: 'parameter-top' });
    const label = create('label', { for: `setting-${field.key}` }, field.label);
    top.append(label); row.append(top);
    if (field.type === 'color') {
      const inputs = create('div', { class: 'color-inputs' });
      const picker = create('input', { type: 'color', id: `setting-${field.key}`, value: field.value });
      const hex = create('input', { type: 'text', class: 'color-hex', 'aria-label': `${field.label} hex`, maxlength: 7, spellcheck: 'false', value: field.value });
      fields.set(field.key, [picker, hex]);
      picker.addEventListener('input', () => changeField(field, picker.value));
      picker.addEventListener('change', () => { commit(); applyNow(); });
      hex.addEventListener('change', () => { changeField(field, hex.value); commit(); applyNow(); });
      inputs.append(picker, hex); top.append(inputs);
    } else {
      const attributes = { min: field.min, max: field.max, step: field.step, value: field.value };
      const slider = create('input', { type: 'range', id: `setting-${field.key}`, ...attributes });
      const number = create('input', { type: 'number', class: 'value-input', 'aria-label': `${field.label} value`, ...attributes });
      fields.set(field.key, [slider, number]);
      slider.addEventListener('input', () => changeField(field, slider.value));
      slider.addEventListener('change', () => { commit(); applyNow(); });
      number.addEventListener('change', () => {
        if (number.value === '') { refreshControls(); return; }
        changeField(field, number.value); commit(); applyNow();
      });
      if (field.hint) slider.setAttribute('aria-describedby', `hint-${field.key}`);
      top.append(number); row.append(slider);
    }
    if (field.hint) row.append(create('p', { class: 'help', id: `hint-${field.key}` }, field.hint));
    fieldset.append(row);
  }
  content.append(fieldset); details.append(summary, content); $('#parameter-groups').append(details);
}

function undo() {
  commit(); if (!historyIndex) return;
  comparing = false; settings = { ...history[--historyIndex] };
  refreshControls(); applyNow(); scheduleSave(); say('Change undone.');
}
function redo() {
  if (historyIndex >= history.length - 1) return;
  comparing = false; settings = { ...history[++historyIndex] };
  refreshControls(); applyNow(); scheduleSave(); say('Change restored.');
}
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
document.addEventListener('keydown', event => {
  if (!engine || !(event.metaKey || event.ctrlKey)) return;
  if (event.target.matches('input:not([type="range"]):not([type="color"]), textarea')) return;
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
});
$('#reset-model').addEventListener('click', () => replaceSettings(DEFAULT_SETTINGS, 'Back to the original miniature. You can undo this.'));
$('#load-site').addEventListener('click', () => replaceSettings(siteSettings, 'Loaded the site preset. You can undo this.'));
$('#compare').addEventListener('click', () => {
  commit(); comparing = !comparing; refreshControls(); applyNow();
  say(comparing ? 'Showing the site preset from the same camera angle. Your draft is untouched.' : 'Back to your draft.');
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => engine?.setView(button.dataset.view)));
$('#preset-name').addEventListener('input', scheduleSave);

function renderLibrary(selected = '') {
  const select = $('#saved-versions'); select.replaceChildren();
  select.append(create('option', { value: '' }, library.length ? 'Choose a saved version' : 'No saved versions yet'));
  for (const item of library) select.append(create('option', { value: item.id }, item.data.name));
  select.value = selected; $('#load-version').disabled = !selected;
}
$('#saved-versions').addEventListener('change', event => { $('#load-version').disabled = !event.target.value; });
$('#save-version').addEventListener('click', () => {
  commit();
  if (library.length >= 40) { say('This browser already has 40 versions. Export a preset to keep another copy.', true); return; }
  const item = { id: crypto.randomUUID(), data: preset(settings, $('#preset-name').value) };
  const next = [...library, item];
  if (!storageWrite(LIBRARY_KEY, JSON.stringify(next))) { say('Browser storage is unavailable. Export a preset instead.', true); return; }
  library = next; renderLibrary(item.id); saveDraft(); say(`Saved “${item.data.name}” in this browser. Not published.`);
});
$('#load-version').addEventListener('click', () => {
  const item = library.find(value => value.id === $('#saved-versions').value);
  if (!item) return;
  $('#preset-name').value = item.data.name;
  replaceSettings(item.data.settings, `Loaded “${item.data.name}”.`);
});
function download(url, name) {
  const link = create('a', { href: url, download: name }); document.body.append(link); link.click(); link.remove();
}
$('#export-preset').addEventListener('click', () => {
  commit(); saveDraft();
  const blob = new Blob([JSON.stringify(preset(settings, $('#preset-name').value), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob); download(url, 'stadium-preset.json');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#versions').open = true;
  say('Preset downloaded. Replace assets/stadium-preset.json to use it on your site.');
});
$('#export-poster').addEventListener('click', () => {
  try {
    // Export the draft, even when the comparison view is showing the site preset.
    engine.updateSettings(settings);
    const night = document.documentElement.dataset.theme !== 'light';
    const filename = night ? 'sofi-poster-night.png' : 'sofi-poster.png';
    download(engine.capturePoster({ night }), filename);
    applyNow(); say(`Matching ${night ? 'nighttime' : 'daytime'} poster downloaded. Replace assets/${filename} alongside your preset.`);
  } catch (error) { say(`Couldn’t export the poster: ${error.message}`, true); }
});
$('#import-preset').addEventListener('click', () => $('#preset-file').click());
$('#preset-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 100_000) throw new Error('Preset files must be smaller than 100 KB.');
    const data = parsePreset(await file.text());
    $('#preset-name').value = data.name;
    replaceSettings(data.settings, `Imported “${data.name}”. You can undo this.`);
  } catch (error) { say(`Couldn’t import that preset: ${error.message}`, true); }
});
$('#preview-home').addEventListener('click', event => {
  if (!engine) { event.preventDefault(); return; }
  commit(); saveDraft();
  if (!storageWrite(PREVIEW_KEY, JSON.stringify(preset(settings, $('#preset-name').value)))) {
    event.preventDefault(); say('Homepage preview needs browser storage. Export a preset instead.', true);
  } else say('Opened a local draft preview. The normal homepage still uses the site preset.');
});
window.addEventListener('pagehide', () => { if (engine) saveDraft(); clearTimeout(applyTimer); applyTimer = 0; });

function fallback() {
  figure.dataset.ready = 'false';
  figure.querySelector('.stadium-hint').textContent = '3D unavailable · showing the site’s still image';
  figure.querySelectorAll('[data-scene-action]').forEach(button => { button.disabled = true; });
  say('The 3D preview is unavailable. Your settings are safe; you can still export a preset. Reload to retry.', true);
  refreshControls();
}
new MutationObserver(() => {
  refreshControls();
  if (engine && figure.dataset.ready === 'true') {
    applyNow();
    if (message.dataset.error === 'true') say('3D preview recovered. Your draft is intact.');
  }
}).observe(figure, { attributes: true, attributeFilter: ['data-ready'] });

async function init() {
  let notice = 'Everything here is a local draft. Nothing is published automatically.';
  try { siteSettings = await loadSiteSettings(); }
  catch { notice = 'Site preset unavailable. Starting from the original miniature.'; }
  settings = { ...siteSettings };
  const saved = storageRead(DRAFT_KEY);
  if (saved) {
    try { const draft = parsePreset(saved); settings = draft.settings; $('#preset-name').value = draft.name; notice = 'Restored your local draft. The site preset has not changed.'; }
    catch { notice = 'Your saved draft could not be read. Starting from the site preset.'; }
  }
  try {
    const data = JSON.parse(storageRead(LIBRARY_KEY) || '[]');
    if (Array.isArray(data)) library = data.slice(0, 40).flatMap(item => {
      try { return typeof item.id === 'string' ? [{ id: item.id, data: parsePreset(item.data) }] : []; } catch { return []; }
    });
  } catch { /* A corrupt library does not prevent loading or importing a draft. */ }
  history = [{ ...settings }]; renderLibrary(); refreshControls();
  for (const id of ['export-preset', 'import-preset', 'save-version', 'reset-model', 'load-site']) $(`#${id}`).disabled = false;
  try {
    const { mountStadium } = await import('./stadium.js');
    engine = await mountStadium(figure, fallback, { settings });
    refreshControls(); applyNow(); say(notice); saveDraft();
  } catch (error) { console.warn('Editor preview unavailable:', error); fallback(); }
}
init();

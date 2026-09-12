// Shared by the scene and editor. No UI or Three.js dependency.
export const PRESET_VERSION = 1;
export const DRAFT_KEY = 'sofi-editor-draft-v1';
export const PREVIEW_KEY = 'sofi-home-preview-v1';
export const LIBRARY_KEY = 'sofi-editor-presets-v1';
export const FIELDS = [
  { key: 'roofWidth', label: 'Canopy width', group: 'Shape', min: .84, max: 1.1, step: .01, value: 1, geometry: true, unit: '×' },
  { key: 'roofHeight', label: 'Canopy height', group: 'Shape', min: .82, max: 1.2, step: .01, value: 1, geometry: true, unit: '×' },
  { key: 'crown', label: 'Roof crown', group: 'Shape', min: -.25, max: .6, step: .01, value: 0, geometry: true, hint: 'Lower is flatter; higher lifts the center.' },
  { key: 'frontAsymmetry', label: 'Front sweep', group: 'Shape', min: -1, max: 1, step: .05, value: 1, geometry: true, hint: 'Positive sweeps the right wing outward; negative swaps sides. Zero makes the front even.' },
  { key: 'cornerReturn', label: 'Inward curl', group: 'Shape', min: 0, max: 1.2, step: .05, value: 1, geometry: true, hint: 'Rolls the short end inward, then opens it out toward the footing. Zero removes the return.' },
  { key: 'tailLength', label: 'Tail length', group: 'Shape', min: .85, max: 1.12, step: .01, value: 1, geometry: true, unit: '×' },
  { key: 'tailOffset', label: 'Tail sweep', group: 'Shape', min: -6.8, max: 6.8, step: .05, value: -6.5, geometry: true, hint: 'Sweeps the tail toward either side of the bowl. Zero centers its point.' },
  { key: 'shoulderTaper', label: 'Side sweep', group: 'Shape', min: 0, max: 1, step: .05, value: .75, geometry: true, hint: 'Low is fuller; high gives the canopy longer, straighter sides.' },
  { key: 'roundness', label: 'Shoulder curve', group: 'Shape', min: 1, max: 2.6, step: .05, value: 1.75, geometry: true, hint: 'A higher value gives the roof a softer roll toward its edge.' },
  { key: 'cornerSoftness', label: 'Corner softness', group: 'Shape', min: .003, max: .02, step: .001, value: .008, geometry: true },
  { key: 'rimThickness', label: 'Rim thickness', group: 'Shape', min: .08, max: .22, step: .01, value: .13, geometry: true },
  { key: 'filmSize', label: 'Glazed roof coverage', group: 'Shape', min: .88, max: 1.02, step: .01, value: 1, geometry: true, unit: '×', hint: 'Extends the glazing toward the outer edge, independently of the oval.' },
  { key: 'ovalWidth', label: 'Oval width', group: 'Shape', min: .82, max: 1.08, step: .01, value: 1, geometry: true, unit: '×' },
  { key: 'ovalLength', label: 'Oval length', group: 'Shape', min: .9, max: 1.08, step: .01, value: 1, geometry: true, unit: '×', hint: 'The oval band auto-fits inside the glazed roof.' },
  { key: 'ovalBandWidth', label: 'Oval border width', group: 'Shape', min: .04, max: .2, step: .01, value: .11, geometry: true },
  { key: 'plazaGlazing', label: 'Glazing toward the tail', group: 'Shape', min: 0, max: 1, step: .05, value: .65, geometry: true, hint: 'Moves the shared curved seam. The solid tail always joins the outer rim.' },
  { key: 'supportThickness', label: 'Column thickness', group: 'Supports', min: .65, max: 1.45, step: .05, value: 1, geometry: true, unit: '×' },
  { key: 'sideColumns', label: 'Columns per side', group: 'Supports', min: 2, max: 6, step: 1, value: 4, geometry: true },
  { key: 'frontColumns', label: 'Entrance columns', group: 'Supports', min: 2, max: 6, step: 1, value: 4, geometry: true },
  { key: 'supportInset', label: 'Column placement', group: 'Supports', min: .65, max: .9, step: .01, value: .8, geometry: true, hint: 'Move toward the span or the outer rim. Tops stay attached.' },
  { key: 'roofColor', label: 'Metal roof', group: 'Materials', type: 'color', value: '#b5babc' },
  { key: 'roofRoughness', label: 'Roof roughness', group: 'Materials', min: .1, max: 1, step: .01, value: .48, hint: 'Low is glossy; high is matte.' },
  { key: 'roofMetalness', label: 'Metallic finish', group: 'Materials', min: 0, max: 1, step: .01, value: .42 },
  { key: 'glassColor', label: 'Translucent roof tint', group: 'Materials', type: 'color', value: '#ffffff' },
  { key: 'glassOpacity', label: 'Roof opacity', group: 'Materials', min: .2, max: 1, step: .01, value: .87 },
  { key: 'columnColor', label: 'Columns', group: 'Materials', type: 'color', value: '#dddeda' },
  // Retained only for old exports/drafts. The surrounding environment is gone.
  { key: 'grassColor', label: 'Legacy landscape', group: 'Materials', type: 'color', value: '#98ab82', hidden: true },
  { key: 'waterColor', label: 'Legacy lake', group: 'Materials', type: 'color', value: '#81b8b8', hidden: true },
  { key: 'gridSpacing', label: 'Roof panel size', group: 'Texture', min: .45, max: 1.2, step: .01, value: .72, geometry: true },
  { key: 'gridOpacity', label: 'Panel line contrast', group: 'Texture', min: 0, max: 1, step: .01, value: .72 },
  { key: 'seamOpacity', label: 'Metal seam contrast', group: 'Texture', min: 0, max: .6, step: .01, value: .16 },
  { key: 'fritDensity', label: 'Fine dot density', group: 'Texture', min: .4, max: 2, step: .05, value: 1, unit: '×', hint: 'Adjusts the repeating dot pattern, not a photo texture.' },
  { key: 'exposure', label: 'Brightness', group: 'Lighting', min: .6, max: 1.5, step: .01, value: 1, unit: '×' },
  { key: 'shadowStrength', label: 'Shadow strength', group: 'Lighting', min: 0, max: 1, step: .05, value: 1 },
  { key: 'lightningAmount', label: 'Burst frequency', group: 'Lightning', min: 0, max: 1, step: .05, value: .6, hint: 'Short electrical arcs, with quiet gaps between them. Zero turns them off.' },
  { key: 'lightningSpeed', label: 'Burst speed', group: 'Lightning', min: 0, max: 1, step: .05, value: .45, hint: 'How quickly arcs flare and fade. Zero freezes the effect; reduced motion also keeps it still.' },
  { key: 'lightningGlow', label: 'Arc glow', group: 'Lightning', min: 0, max: 1, step: .05, value: .5 },
  { key: 'lightningColor', label: 'Powder blue', group: 'Lightning', type: 'color', value: '#0080c6' },
  { key: 'lightningAccent', label: 'Bolt gold', group: 'Lightning', type: 'color', value: '#ffc820' },
];
export const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(FIELDS.map(f => [f.key, f.value])));
export const GEOMETRY_KEYS = FIELDS.filter(f => f.geometry).map(f => f.key);

export function normalizeSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.');
  const result = {};
  for (const field of FIELDS) {
    const value = Object.hasOwn(input, field.key) ? input[field.key] : field.value;
    if (field.type === 'color') {
      if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error(`Invalid color for ${field.label}.`);
      result[field.key] = value.toLowerCase();
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid number for ${field.label}.`);
      const clamped = Math.min(field.max, Math.max(field.min, value));
      result[field.key] = Number((field.min + Math.round((clamped - field.min) / field.step) * field.step).toFixed(4));
    }
  }
  return result;
}

export function preset(settings, name = 'My SoFi') {
  return { version: PRESET_VERSION, name: String(name).trim().slice(0, 80) || 'My SoFi', settings: normalizeSettings(settings) };
}
export function parsePreset(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!data || data.version !== PRESET_VERSION || !data.settings) throw new Error('Use a version 1 SoFi preset exported by this editor.');
  const unknown = Object.keys(data.settings).filter(key => !Object.hasOwn(DEFAULT_SETTINGS, key));
  if (unknown.length) throw new Error(`Unknown setting: ${unknown[0]}.`);
  return preset(data.settings, data.name);
}
export async function loadSiteSettings() {
  const response = await fetch(new URL('./stadium-preset.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load the site preset.');
  return parsePreset(await response.json()).settings;
}

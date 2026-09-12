import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, FIELDS, GEOMETRY_KEYS, normalizeSettings, parsePreset, preset } from '../assets/stadium-settings.js';

test('defaults normalize without drifting and do not mutate', () => {
  assert.deepEqual(normalizeSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  const copy = normalizeSettings(); copy.roofWidth = .95;
  assert.equal(DEFAULT_SETTINGS.roofWidth, 1);
  assert.equal(Object.keys(DEFAULT_SETTINGS).length, FIELDS.length);
});
test('numbers clamp and snap to safe steps', () => {
  const result = normalizeSettings({ roofWidth: 20, sideColumns: 4.3, frontColumns: -10, cornerSoftness: .0108 });
  assert.equal(result.roofWidth, 1.1); assert.equal(result.sideColumns, 4);
  assert.equal(result.frontColumns, 2); assert.equal(result.cornerSoftness, .011);
  for (const field of FIELDS.filter(f => f.type !== 'color')) {
    assert.equal(normalizeSettings({ [field.key]: -1e6 })[field.key], field.min);
    assert.equal(normalizeSettings({ [field.key]: 1e6 })[field.key], field.max);
  }
});
test('invalid values cannot reach geometry or materials', () => {
  for (const value of [null, [], 12, 'bad']) assert.throws(() => normalizeSettings(value));
  for (const value of [null, '1', true, NaN, Infinity, {}]) assert.throws(() => normalizeSettings({ roofWidth: value }));
  for (const value of ['red', '#fff', 'url(x)', null, 3]) assert.throws(() => normalizeSettings({ roofColor: value }));
  assert.equal(normalizeSettings({ roofColor: '#ABCDEF' }).roofColor, '#abcdef');
});
test('versioned presets round trip, reject unrelated files and unknown keys', () => {
  const data = preset({ tailLength: .91, roofColor: '#112233' }, 'A study');
  assert.deepEqual(parsePreset(JSON.stringify(data)), data);
  assert.equal(preset({}, 'x'.repeat(200)).name.length, 80);
  for (const value of [{}, null, { version: 2, settings: {} }, { version: 1, settings: { typo: 1 } }, { version: 1, settings: [] }]) {
    assert.throws(() => parsePreset(value));
  }
});
test('material edits do not trigger geometry rebuilds', () => {
  assert(GEOMETRY_KEYS.includes('roofWidth')); assert(GEOMETRY_KEYS.includes('gridSpacing'));
  assert(!GEOMETRY_KEYS.includes('roofColor')); assert(!GEOMETRY_KEYS.includes('exposure'));
});
test('site preset retains the finish and calibrated shell proportions within editor ranges', async () => {
  const data = await readFile(new URL('../assets/stadium-preset.json', import.meta.url), 'utf8');
  const settings = parsePreset(data).settings;
  assert.deepEqual(Object.fromEntries(GEOMETRY_KEYS.map(key => [key, settings[key]])), {
    roofWidth: .87, roofHeight: .82, crown: .02, frontAsymmetry: -1, cornerReturn: 0,
    tailLength: 1.12, tailOffset: 6.5, shoulderTaper: 1, roundness: 1.4,
    cornerSoftness: .004, rimThickness: .15, filmSize: .94, ovalWidth: 1.08,
    ovalLength: .9, ovalBandWidth: .11, plazaGlazing: .45,
    supportThickness: .95, sideColumns: 6, frontColumns: 4, supportInset: .8,
    gridSpacing: .71,
  });
  assert.equal(normalizeSettings({ roofWidth: .87 }).roofWidth, .87, 'The editor must allow widths below the old .92 limit');
  assert.equal(settings.roofColor, '#f5f4ef');
  assert.equal(settings.roofRoughness, .62);
  assert.equal(settings.roofMetalness, .38);
  assert.equal(settings.glassOpacity, .76);
});
test('old environment presets remain compatible without exposing obsolete controls', () => {
  const settings = parsePreset({ version: 1, settings: { grassColor: '#385418', waterColor: '#407272', roofWidth: .87 } }).settings;
  assert.equal(settings.grassColor, '#385418'); assert.equal(settings.waterColor, '#407272');
  assert.equal(settings.roofWidth, .87); assert.equal(settings.lightningAmount, .6);
  assert(FIELDS.find(f => f.key === 'grassColor').hidden);
  assert(FIELDS.find(f => f.key === 'waterColor').hidden);
  for (const key of ['lightningAmount', 'lightningSpeed', 'lightningGlow', 'lightningColor', 'lightningAccent']) {
    assert(!GEOMETRY_KEYS.includes(key), 'Particle edits must not rebuild the stadium');
  }
});
test('older version 1 presets gain roof controls without losing saved settings', () => {
  const old = { version: 1, name: 'My SoFi', settings: { roofWidth: .97, filmSize: 1.02, glassOpacity: .61 } };
  const upgraded = parsePreset(old).settings;
  for (const [key, value] of Object.entries(old.settings)) assert.equal(upgraded[key], value);
  for (const key of ['frontAsymmetry', 'cornerReturn', 'tailOffset', 'shoulderTaper', 'ovalWidth', 'ovalLength', 'ovalBandWidth', 'plazaGlazing']) {
    assert.equal(upgraded[key], DEFAULT_SETTINGS[key]); assert(GEOMETRY_KEYS.includes(key));
  }
});

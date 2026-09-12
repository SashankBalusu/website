import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFloorOutline, FLOOR_TOP, FLOOR_DEPTH, FLOOR_BEVEL } from '../assets/stadium-floor.js';
import { createRoofProfile, polygonContains } from '../assets/stadium-roof.js';
import { DEFAULT_SETTINGS, FIELDS, normalizeSettings, parsePreset } from '../assets/stadium-settings.js';

const site = parsePreset(await readFile(new URL('../assets/stadium-preset.json', import.meta.url), 'utf8')).settings;
const variants = [DEFAULT_SETTINGS, site];
for (const field of FIELDS.filter(f => f.geometry)) {
  for (const value of [field.min, field.max]) variants.push(normalizeSettings({ ...site, [field.key]: value }));
}
for (const bound of ['min', 'max']) {
  variants.push(normalizeSettings({ ...site, ...Object.fromEntries(FIELDS.filter(f => f.geometry).map(f => [f.key, f[bound]])) }));
}

test('floor is a compact, convex outline without crossings or runaway corners', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings), floor = createFloorOutline(settings, roof);
    assert(floor.length > 20 && floor.length < 200);
    for (let i = 0; i < floor.length; i++) {
      const a = floor[i], b = floor[(i + 1) % floor.length], c = floor[(i + 2) % floor.length];
      assert(a.every(Number.isFinite));
      assert(Math.abs(a[0]) < 8.1 && Math.abs(a[1]) < 12, 'No surrounding landscape-sized platform, including the full lateral tail sweep');
      assert((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0, 'Outline must remain convex');
    }
    assert.deepEqual(floor, createFloorOutline(settings, roof));
  }
});

test('floor contains the swept canopy, unscaled bowl and front foundations across edits', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings), floor = createFloorOutline(settings, roof);
    for (let i = 0; i < 192; i++) {
      const u = i / 192, angle = u * Math.PI * 2;
      for (const radius of [.72, .84, .93, 1]) {
        const [x, , z] = roof.deform(roof.radialPoint(u, radius));
        assert(polygonContains(floor, x * settings.roofWidth, z), 'Floor must cover the roof projection');
      }
      assert(polygonContains(floor, 4.48 * Math.sin(angle), -2.2 + 5.63 * Math.cos(angle)), 'Interior footprint must stay covered');
    }
    for (const u of [0, .375, .625]) {
      const outside = roof.deform(roof.edge(u));
      const edge = roof.edge(u), inside = roof.surfacePoint(edge[0], edge[2], -settings.rimThickness);
      const x = (outside[0] + inside[0]) / 2, z = (outside[2] + inside[2]) / 2;
      for (const dx of [-.15, .15]) for (const dz of [-.175, .175]) {
        assert(polygonContains(floor, (x + dx) * settings.roofWidth, z + dz), 'Whole foundation must sit on the slab');
      }
    }
  }
});

test('slab stays just below the field with a thin edge, independently of canopy height', () => {
  assert(FLOOR_TOP < 0 && FLOOR_TOP >= -.02);
  assert(FLOOR_DEPTH + 2 * FLOOR_BEVEL < .2);
  const low = { ...site, roofHeight: .82 }, high = { ...site, roofHeight: 1.2 };
  assert.deepEqual(createFloorOutline(low, createRoofProfile(low)), createFloorOutline(high, createRoofProfile(high)));
});

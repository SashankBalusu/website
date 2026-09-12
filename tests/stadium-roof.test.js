import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, FIELDS, normalizeSettings, parsePreset } from '../assets/stadium-settings.js';
import { createRoofProfile, polygonContains } from '../assets/stadium-roof.js';

const site = parsePreset(await readFile(new URL('../assets/stadium-preset.json', import.meta.url), 'utf8')).settings;
const variants = [DEFAULT_SETTINGS, site];
for (const field of FIELDS.filter(f => f.geometry)) {
  for (const value of [field.min, field.max]) variants.push(normalizeSettings({ ...site, [field.key]: value }));
}
variants.push(normalizeSettings(Object.fromEntries(FIELDS.filter(f => f.geometry).map(f => [f.key, f.min]))));
variants.push(normalizeSettings(Object.fromEntries(FIELDS.filter(f => f.geometry).map(f => [f.key, f.max]))));

function closePoint(a, b, message) {
  assert(Math.hypot(...a.map((coordinate, i) => coordinate - b[i])) < 1e-8, message);
}
function assertConnected(roof) {
  for (let i = 0; i <= roof.seamSegments; i++) {
    const t = i / roof.seamSegments;
    closePoint(roof.seamPoint(t), roof.tailSurface(t, 0), 'Tail must start exactly on the curved seam');
    closePoint(roof.seamPoint(t), roof.filmPoint((roof.bodySegments + i) / roof.filmSegments), 'Film and tail must share every seam vertex');
    closePoint(roof.deform(roof.seamPoint(t)), roof.deform(roof.tailSurface(t, 0)), 'Folded layers must still share the seam');
  }
  for (let i = 0; i <= roof.radialSegments; i++) {
    const t = i / roof.radialSegments;
    closePoint(roof.perimeterPoint(1, t), roof.tailSurface(0, t), 'Left tail edge must join perimeter');
    closePoint(roof.perimeterPoint(0, t), roof.tailSurface(1, t), 'Right tail edge must join perimeter');
  }
  closePoint(roof.tailSurface(.5, 1), roof.edge(0), 'The solid tail must reach the actual canopy tip');
}

test('roof layers remain finite, nested, and continuous across editor ranges', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    const outer = Array.from({ length: 512 }, (_, i) => { const p = roof.edge(i / 512); return [p[0], p[2]]; });
    for (let i = 0; i < 256; i++) {
      const u = i / 256, edge = roof.edge(u), glass = roof.filmPoint(u), oval = roof.ovalPoint(u);
      assert(edge.every(Number.isFinite) && glass.every(Number.isFinite) && oval.every(Number.isFinite));
      assert(polygonContains(outer, glass[0], glass[2]), 'Glazing must stay inside the rim');
      assert(polygonContains(roof.filmPolygon, oval[0], oval[2]), 'Oval must stay inside glazing');
      assert(Math.abs(roof.height(edge[0], edge[2]) - edge[1]) < .005, 'Roof must meet edge without cracks');
      for (let r = 0; r <= 1; r += .1) {
        const p = roof.radialPoint(u, r);
        assert(p.every(Number.isFinite));
        assert(p[1] > .08 && p[1] < 4.2, 'The sheet must not develop downward folds or interpolation humps');
      }
    }
    assertConnected(roof);
    for (let u = .05; u < 1; u += .1) {
      for (let t = .05; t < 1; t += .1) {
        const p = roof.tailSurface(u, t);
        assert(p.every(Number.isFinite));
        assert(polygonContains(outer, p[0], p[2]), 'Solid tail must remain inside the canopy');
        assert(!polygonContains(roof.filmPolygon, p[0], p[2]), 'Glass must not continue beneath the solid tail');
      }
    }
    assert.deepEqual(roof.edge(0), roof.edge(1));
  }
});
test('the short return passes vertical, narrows at its waist, then flares into its footing', () => {
  for (const settings of [DEFAULT_SETTINGS, { ...site, cornerReturn: 1.2 }, { ...site, cornerReturn: 1.2, frontAsymmetry: 1 }]) {
    const roof = createRoofProfile(settings), side = Math.sign(settings.frontAsymmetry);
    const station = u => side > 0 ? u : 1 - u;
    const baseTip = roof.edge(station(.375)), lip = roof.deform(baseTip);
    assert((baseTip[0] - lip[0]) * side > .1, 'The footing must stay within the uncurled plan');
    assert.equal(lip[2], baseTip[2], 'The inward curl must not move the tip behind the front line');
    assert.equal(lip[1], baseTip[1], 'Curling must not lift the end away from its footing');
    const trace = Array.from({ length: 201 }, (_, i) => roof.deform(roof.edge(station(.375 + i * .0005))));
    const waist = Math.min(...trace.filter(p => p[1] < 1.5).map(p => p[0] * side));
    const overhang = Math.max(...trace.filter(p => p[1] >= 1.5).map(p => p[0] * side));
    assert(overhang - waist > .45, 'The upper curve must roll outward above the recessed waist');
    assert(lip[0] * side - waist > .65, 'The lower return must open outward again instead of ending as a pinched hook');
    let underNormal = 1;
    for (let i = 0; i <= 40; i++) {
      const p = roof.radialPoint(station(.35 + i * .0015), .97);
      underNormal = Math.min(underNormal, roof.surfaceNormal(p[0], p[2])[1]);
    }
    assert(underNormal < -.15, 'The outer surface must turn below vertical into a genuine undercut');
    const unfolded = createRoofProfile({ ...settings, cornerReturn: 0 });
    closePoint(unfolded.deform(baseTip), baseTip, 'Zero must disable the curl');
    for (const u of [0, .1, .2, .5, .625, .8, .9]) {
      const p = roof.edge(station(u));
      closePoint(roof.deform(p), p, 'The long wing, upper span and tail must stay unchanged');
    }
  }
});
test('folded roof normals and shared edges remain valid across the editor ranges', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    for (let i = 0; i <= 48; i++) {
      for (const r of [.5, .82, .95, 1]) {
        const base = roof.radialPoint(i / 48, r), point = roof.deform(base);
        const normal = roof.surfaceNormal(base[0], base[2]);
        assert(point.every(Number.isFinite) && normal.every(Number.isFinite));
        assert(Math.abs(Math.hypot(...normal) - 1) < 1e-8);
        closePoint(point, roof.surfacePoint(base[0], base[2]), 'Grid lines and meshes must use the same 3D surface');
      }
    }
    for (let i = 0; i <= roof.radialSegments; i++) {
      const t = i / roof.radialSegments;
      closePoint(roof.deform(roof.perimeterPoint(0, t)), roof.deform(roof.tailSurface(1, t)), 'Folded perimeter must stay connected');
      closePoint(roof.deform(roof.perimeterPoint(1, t)), roof.deform(roof.tailSurface(0, t)), 'Folded perimeter must stay connected');
    }
  }
});
test('panel grid follows extended glazing and does not cross the solid tail', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    for (const axis of [0, 1]) {
      for (let value = -10; value <= 11; value += .47) {
        for (const [a, b] of roof.panelSegments(axis, value)) {
          for (const t of [.01, .25, .5, .75, .99]) {
            const p = a.map((coordinate, i) => coordinate + (b[i] - coordinate) * t);
            assert(polygonContains(roof.filmPolygon, ...p));
            assert(!polygonContains(roof.tailPolygon, ...p));
          }
        }
      }
    }
  }
});
test('the swept corner descends along both the front and the adjacent side', () => {
  for (const settings of [DEFAULT_SETTINGS, site]) {
    const roof = createRoofProfile(settings);
    for (const mirror of [u => u, u => 1 - u]) {
      const sideHeights = Array.from({ length: 7 }, (_, i) => roof.edge(mirror(.2 + i * .01))[1]);
      assert(Math.max(...sideHeights) - Math.min(...sideHeights) < .15, 'The middle span must stay broad and high');
      const corner = roof.edge(mirror(.375));
      assert(corner[1] < .9, 'The prong must still curl down close to its foundation');
    }
    const station = u => settings.frontAsymmetry > 0 ? u : 1 - u;
    assert(roof.edge(station(.675))[1] < roof.edge(station(.325))[1] - .7, 'The side adjoining the long wing must slope down with it, not stay vertical at the tip');
  }
});
test('front sweep extends a gradual wing and can swap sides without changing the tail', () => {
  for (const settings of [DEFAULT_SETTINGS, site, { ...site, frontAsymmetry: 1 }]) {
    const roof = createRoofProfile(settings);
    const direction = Math.sign(settings.frontAsymmetry);
    const frontU = u => direction > 0 ? 1 - u : u;
    assert(roof.edge(frontU(.56))[1] - roof.edge(frontU(.44))[1] > .65, 'Mirrored front stations must have visibly different heights');
    // The five-sample corner easing straddles the tip; check the rising wing
    // after that rounded transition, not the turn around the corner itself.
    const wingStart = .375 + 2 * settings.cornerSoftness;
    const wing = Array.from({ length: 15 }, (_, i) => roof.edge(frontU(wingStart + (.515 - wingStart) * i / 14))[1]);
    for (let i = 1; i < wing.length; i++) assert(wing[i] > wing[i - 1], 'The long wing must rise continuously into the crest');
    assert(roof.edge(frontU(.515))[0] * direction > .6, 'The crest must be offset away from the swept wing');
    assert(roof.edge(frontU(.585))[1] > 1.95, 'The short end must enter the inward curl after the rounded shoulder');
    assert(roof.radialPoint(frontU(.625), .7)[1] > 2.9, 'The tighter return must not carve a crease through the main glazing');
    const symmetric = createRoofProfile({ ...settings, frontAsymmetry: 0 });
    for (const u of [.4, .44, .48]) assert(Math.abs(symmetric.edge(u)[1] - symmetric.edge(1 - u)[1]) < 1e-8);
    const tip = roof.edge(frontU(.375)), evenTip = symmetric.edge(frontU(.375));
    assert(Math.abs(tip[0]) - Math.abs(evenTip[0]) > .7, 'The wing must extend outward, not just bend down');
    assert.equal(tip[2], evenTip[2], 'Extending the wing must not pull it ahead of the other tip');
    const swapped = createRoofProfile({ ...settings, frontAsymmetry: -settings.frontAsymmetry });
    for (let i = 0; i <= 64; i++) {
      const u = .375 + .25 * i / 64;
      const a = roof.edge(u), b = swapped.edge(1 - u);
      closePoint(a, [-b[0], b[1], b[2]], 'Changing the sign must swap the whole front sweep');
    }
    for (const u of [0, .1, .2, .8, .9]) closePoint(roof.edge(u), symmetric.edge(u), 'Front edits must leave the tail and rear edges alone');
    assertConnected(roof);
  }
});
test('front tips share a landing height and depth across editor ranges', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    const a = roof.deform(roof.edge(.375)), b = roof.deform(roof.edge(.625));
    assert(Math.abs(a[1] - b[1]) < 1e-4, 'Both tips must meet the same horizontal landing height');
    assert(Math.abs(a[2] - b[2]) < 1e-8, 'Neither front tip may sit farther forward');
  }
});
test('the upper front rim does not project outward into a central ledge', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    for (let i = 0; i <= 32; i++) {
      const p = roof.edge(.43 + .14 * i / 32);
      assert(Math.abs(p[2] - roof.frontZ) < 1e-8, 'The front span must stay in a common plane, without a central nose');
    }
  }
});
test('the long front wing turns continuously through the former ramp-to-shoulder join', () => {
  for (const settings of [DEFAULT_SETTINGS, site, { ...site, frontAsymmetry: 1 }]) {
    const roof = createRoofProfile(settings), direction = -Math.sign(settings.frontAsymmetry);
    // Measure elevation in actual X, including the old line/ellipse junction.
    // Curvature must remain gentle and continuous through that junction; a
    // merely tangent line/ellipse join still has an abrupt change in bending.
    const step = .06;
    const heights = Array.from({ length: 81 }, (_, i) => roof.height(direction * (-.5 + i * step), roof.frontZ));
    let previous;
    for (let i = 1; i < heights.length - 1; i++) {
      const curvature = (heights[i + 1] - 2 * heights[i] + heights[i - 1]) / step ** 2;
      assert(curvature < -.03 && curvature > -.2, 'The wing must rise as a shallow, steadily turning curve');
      if (previous !== undefined) assert(Math.abs(curvature - previous) < .02,
        'Bending must change gradually, without a sudden transition into the crest');
      previous = curvature;
    }
  }
});
test('the visible upper shoulder keeps turning rather than flattening into a raised shelf', () => {
  for (const settings of [DEFAULT_SETTINGS, site, { ...site, frontAsymmetry: 1 }]) {
    const roof = createRoofProfile(settings), direction = -Math.sign(settings.frontAsymmetry);
    // Inspect both the top edge and the underside of the thick visible rim.
    // A coplanar outline alone cannot catch a bump in front elevation.
    for (const offset of [0, -settings.rimThickness]) {
      const points = Array.from({ length: 25 }, (_, i) => {
        const p = roof.surfacePoint(direction * (-2.5 + i * .1), roof.frontZ, offset);
        return [p[0] * direction, p[1]];
      });
      let previousSlope;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dx = b[0] - a[0];
        const slope = (b[1] - a[1]) / dx;
        if (previousSlope !== undefined) assert((slope - previousSlope) / dx < -.04,
          'The shoulder must have sustained curvature, not a shelf between two separate bends');
        previousSlope = slope;
      }
    }
  }
});
test('oval proportions, glazing, and perimeter can be edited independently', () => {
  const initial = createRoofProfile(site);
  const oval = createRoofProfile({ ...site, ovalWidth: .85 });
  assert(oval.ovalRX < initial.ovalRX);
  assert.deepEqual(oval.filmPolygon, initial.filmPolygon);
  assert.deepEqual(oval.edge(.17), initial.edge(.17));
  assert.deepEqual(oval.roofPoint(.2, .8), initial.roofPoint(.2, .8), 'Decorative oval edits must not move the supports');
  const glazed = createRoofProfile({ ...site, plazaGlazing: 1 });
  assert.notDeepEqual(glazed.tailPolygon, initial.tailPolygon);
  // Moving the seam resamples the polygon. Auto-fitting can shift by a tiny
  // tessellation tolerance when the wider oval already touches that envelope.
  assert(Math.abs(glazed.ovalRX - initial.ovalRX) < .001);
  assert.notDeepEqual(glazed.filmPolygon, initial.filmPolygon, 'Moving the seam must change the actual film boundary');
  assert.deepEqual(glazed.edge(.17), initial.edge(.17), 'Moving the seam must leave the outer roof unchanged');
  const nearFrontZ = initial.centerZ - initial.ovalRZ * .9;
  const ovalHalfSpan = initial.ovalRX * Math.sqrt(1 - .9 ** 2);
  const outsideOval = initial.panelSegments(1, nearFrontZ);
  assert(outsideOval.some(([a, b]) => a[0] < -ovalHalfSpan - .4 && b[0] > ovalHalfSpan + .4),
    'Glazing must extend across both front shoulders, beyond the decorative oval');
});
test('tail sweep bends the plan without pinching its sections or moving the front prongs', () => {
  const centered = createRoofProfile({ ...site, tailOffset: 0 });
  for (const tailOffset of [-6.8, -6.5, -1.4, 1.4, 6.5, 6.8]) {
    const swept = createRoofProfile({ ...site, tailOffset });
    assert(Math.abs(swept.edge(0)[0] - tailOffset) < .01);
    assertConnected(swept);
    for (const u of [.375, .5, .625]) closePoint(centered.edge(u), swept.edge(u), 'Front prongs must stay put');
    assert.notDeepEqual(swept.roofPoint(.1, .8), centered.roofPoint(.1, .8), 'Rear supports follow the sweep');
    const start = swept.sweepStart, end = swept.sweepEnd;
    const nearStart = swept.sweep(0, start + .0001);
    assert(Math.abs(nearStart[0]) < 1e-8, 'The bend must join the straight body smoothly');
    const nearEnd = swept.sweep(0, end - .01);
    assert((tailOffset - nearEnd[0]) * Math.sign(tailOffset) > .001, 'The point must keep turning toward the swept side');
    const left = swept.sweep(-1, end - .5), right = swept.sweep(1, end - .5);
    assert.equal(left[1], right[1], 'Transverse sections must stay parallel rather than hooking the outer edge');
    assert(Math.abs(right[0] - left[0] - 2) < 1e-8, 'Sweeping must preserve the width of the sheet');
    assert.equal(swept.tailYaw(end), 0, 'Theater entrances and stairs follow those parallel sections');
    assert(Math.abs(swept.sweep(0, (start + end) / 2)[0] - tailOffset / 4) < 1e-8, 'The turn must build progressively toward the tail');
  }
  assert(Math.abs(centered.edge(0)[0]) < 1e-8);
});
test('site silhouette follows the offset sail and broad oval in the HKS roof plan', () => {
  const roof = createRoofProfile(site);
  // HKS plan reference linked in STADIUM.md; sbp gives the principal cable
  // roof as 770 by 980 feet. These are proportion checks, not survey precision.
  const aspect = roof.ovalRX * site.roofWidth / roof.ovalRZ;
  assert(aspect > .76 && aspect < .80, 'The principal oval must not become a narrow egg');
  const pointOffset = roof.edge(0)[0] / roof.ovalRX;
  assert(pointOffset > 1.25 && pointOffset < 1.45, 'The tail point sits beside the main oval, not near its centerline');
  assert(Math.abs(roof.deform(roof.edge(.65))[0]) < Math.abs(roof.edge(.75)[0]) * .84,
    'The short shoulder must taper into the entrance rather than continue as a boxy side');
  const lip = roof.deform(roof.edge(.625)), wing = roof.deform(roof.edge(.375));
  assert(Math.abs(lip[0]) < Math.abs(wing[0]) * .7, 'The curled return has a distinctly shorter reach than the diagonal wing');
  assert(site.rimThickness <= .16, 'The rim must read as a thin sheet at the current model scale');
});
test('bent height sampling inverts the sweep without folds across control ranges', () => {
  for (const settings of variants) {
    const roof = createRoofProfile(settings);
    for (let i = 0; i < 128; i++) {
      for (const radius of [.1, .5, .8, 1]) {
        const p = roof.radialPoint(i / 128, radius);
        const local = roof.unsweep(p[0], p[2]);
        const world = roof.sweep(...local);
        assert(Math.hypot(world[0] - p[0], world[1] - p[2]) < 1e-8);
        assert(Math.abs(roof.height(p[0], p[2]) - p[1]) < 1e-7, 'Mesh and height field must agree after bending');
      }
    }
  }
});
test('mixed shape controls keep the seam connected and oval contained', () => {
  let seed = 37;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 100; i++) {
    const settings = normalizeSettings(Object.fromEntries(FIELDS.filter(f => f.geometry)
      .map(f => [f.key, f.min + random() * (f.max - f.min)])));
    const roof = createRoofProfile(settings);
    assertConnected(roof);
    const left = roof.deform(roof.edge(.375)), right = roof.deform(roof.edge(.625));
    assert(Math.abs(left[1] - right[1]) < 1e-4 && Math.abs(left[2] - right[2]) < 1e-8,
      'Combining controls must not misalign the front tips');
    for (let j = 0; j < 128; j++) {
      const p = roof.ovalPoint(j / 128);
      assert(polygonContains(roof.filmPolygon, p[0], p[2]));
    }
  }
});

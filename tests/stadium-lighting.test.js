import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createRoofProfile } from '../assets/stadium-roof.js';
import { createStadiumLighting } from '../assets/stadium-lighting.js';
import { parsePreset } from '../assets/stadium-settings.js';

const site = parsePreset(await readFile(new URL('../assets/stadium-preset.json', import.meta.url), 'utf8')).settings;
function build(settings = site) {
  const profile = createRoofProfile(settings);
  const theaterOutline = new THREE.CatmullRomCurve3([[-2.15,5.05],[2.15,5.05],[2.25,6.1],
    [1.15,8.25],[0,9.1],[-1.15,8.25],[-2.25,6.1]].map(([x,z]) => new THREE.Vector3(x, 0, profile.tailZ(z))), true, 'catmullrom', .25);
  const supports = [.13, .2, .265, .325, .44, .5, .56, .675, .735, .8, .87].map(u => profile.roofPoint(u, .8));
  const lighting = createStadiumLighting(THREE, { profile, settings, supports, theaterOutline,
    theaterHeight: z => 1.15 - (4.3 + (z - 4.3) / settings.tailLength - 5) * .21 });
  return { profile, lighting };
}

test('night lighting stays finite and bounded, with no extra shadow passes', () => {
  for (const settings of [site, { ...site, tailOffset: -6.8, roofWidth: .84, roofHeight: 1.2 }]) {
    const { lighting } = build(settings);
    assert.equal(lighting.visible, false, 'Daylight must start with architectural lights disabled');
    let lights = 0, draws = 0, triangles = 0;
    lighting.traverse(object => {
      assert.equal(object.castShadow, false);
      if (object.isLight) { lights++; assert(object.distance > 0); }
      if (!object.geometry) return;
      draws++;
      for (const attribute of Object.values(object.geometry.attributes)) assert([...attribute.array].every(Number.isFinite));
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
      if (object.isInstancedMesh) assert([...object.instanceMatrix.array].every(Number.isFinite));
    });
    assert.equal(lights, 4);
    assert(draws <= 16, `Light fixture draws: ${draws}`);
    assert(triangles < 50000, `Lighting triangles: ${triangles}`);
    const flood = lighting.getObjectByName('White bowl floodlights');
    assert.equal(flood.position.z, -2.2, 'Floodlighting belongs over the actual, unscaled bowl');
  }
});

test('the glow sheet stays outside the curved roof between vertices, including the front return', () => {
  for (const settings of [site, { ...site, cornerReturn: 1.2 }]) {
    const { profile, lighting } = build(settings);
    const glow = lighting.getObjectByName('Blue light scattered over the roof edge');
    const { position, uv } = glow.geometry.attributes, indices = glow.geometry.index.array;
    // Check triangle interiors: endpoint-only checks miss a coarse strip cutting
    // straight through the roof and producing the bright spikes at the entrance.
    let minimum = Infinity;
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]];
      const average = (attribute, axis) => ids.reduce((sum, j) => sum + attribute.getComponent(j, axis), 0) / 3;
      const u = average(uv, 0), radius = .95 + average(uv, 1) * .05;
      const base = profile.radialPoint(u, radius), surface = profile.deform(base);
      const normal = profile.surfaceNormal(base[0], base[2]);
      const distance = normal.reduce((sum, n, axis) => sum + n * (average(position, axis) - surface[axis]), 0);
      minimum = Math.min(minimum, distance);
    }
    assert(minimum > .005, `The interpolated halo must clear the sheet; minimum gap: ${minimum}`);
    assert.equal(glow.material.depthWrite, false);
    assert.equal(glow.material.depthTest, true, 'The roof still needs to occlude lighting on its opposite side');
  }
});

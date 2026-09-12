import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { lightningLayout, burstSpacing, BURST_DURATION, MAX_BURSTS, createLightning } from '../assets/stadium-lightning.js';
import { DEFAULT_SETTINGS } from '../assets/stadium-settings.js';

test('each deterministic discharge has a connected irregular trunk and three tapered forks', () => {
  const layout = lightningLayout();
  assert.deepEqual(layout, lightningLayout());
  assert.equal(layout.length, MAX_BURSTS);
  for (const strokes of layout) {
    assert.equal(strokes.length, 31);
    for (const stroke of strokes) {
      assert([...stroke.start, ...stroke.end, stroke.strength, stroke.progress].every(Number.isFinite));
      assert.notDeepEqual(stroke.start, stroke.end);
      assert(stroke.strength > 0 && stroke.strength <= 1);
      assert(stroke.progress > 0 && stroke.progress <= 1);
    }
    for (let i = 1; i < 16; i++) assert.deepEqual(strokes[i].start, strokes[i - 1].end);
    for (const [branch, joint] of [5, 9, 12].entries()) {
      const index = 16 + branch * 5;
      assert.deepEqual(strokes[index].start, strokes[joint].start);
      for (let i = index + 1; i < index + 5; i++) assert.deepEqual(strokes[i].start, strokes[i - 1].end);
      assert(strokes[index + 4].strength < strokes[index].strength);
    }
    assert.equal(strokes.filter(s => s.gold).length, 5);
  }
});
test('extended arcs have a longer trunk and forks without adding segments', () => {
  const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  for (const strokes of lightningLayout()) {
    const reach = distance(strokes[0].start, strokes[15].end);
    assert(reach > 4 && reach < 6.3, 'The trunk should span about 4–6 model units');
    for (const index of [16, 21, 26]) {
      assert(distance(strokes[index].start, strokes[index + 4].end) > 1.3, 'Forks should extend with the trunk');
    }
    assert.equal(strokes.length, 31);
  }
});
test('bursts have quiet gaps even at maximum frequency and speed', () => {
  assert(burstSpacing(1) > BURST_DURATION * 2);
  assert(burstSpacing(.6) > burstSpacing(1));
  assert.equal(burstSpacing(-1), burstSpacing(0));
  assert.equal(burstSpacing(2), burstSpacing(1));
});
test('one batched draw, in-place controls, full disable and resource cleanup', () => {
  const effects = createLightning(THREE);
  effects.update(DEFAULT_SETTINGS);
  const geometry = effects.mesh.geometry, material = effects.mesh.material;
  assert(geometry.isBufferGeometry);
  assert.equal(geometry.getAttribute('position').count, MAX_BURSTS * 31 * 6);
  for (const name of ['aStart', 'aEnd', 'aTiming']) {
    assert.equal(geometry.getAttribute(name).count, geometry.getAttribute('position').count);
  }
  assert.equal(effects.uniforms.uSpacing.value, burstSpacing(.6));
  assert.equal(material.depthWrite, false);
  effects.update({ ...DEFAULT_SETTINGS, lightningAmount: 0 });
  assert.equal(effects.mesh.visible, false);
  effects.update({ ...DEFAULT_SETTINGS, lightningGlow: 0 });
  assert.equal(effects.mesh.visible, false);
  effects.update({ ...DEFAULT_SETTINGS, lightningColor: '#123456', lightningAmount: 1 });
  assert.equal(effects.mesh.visible, true);
  assert.equal(effects.uniforms.uBlue.value.getHexString(), '123456');
  assert.equal(effects.uniforms.uSpacing.value, burstSpacing(1));
  assert.equal(effects.mesh.geometry, geometry); assert.equal(effects.mesh.material, material);
  let freed = 0;
  geometry.addEventListener('dispose', () => freed++);
  material.addEventListener('dispose', () => freed++);
  effects.dispose(); assert.equal(freed, 2);
});

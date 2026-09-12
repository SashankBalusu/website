import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createStadiumInterior } from '../assets/stadium-interior.js';
import { createRoofProfile, polygonContains } from '../assets/stadium-roof.js';
import { createFloorOutline } from '../assets/stadium-floor.js';
import { parsePreset, normalizeSettings } from '../assets/stadium-settings.js';

const site = parsePreset(await readFile(new URL('../assets/stadium-preset.json', import.meta.url), 'utf8')).settings;

test('detailed interior stays inside the existing foundation and under the canopy', () => {
  const { interior } = createStadiumInterior(THREE);
  const bounds = new THREE.Box3().setFromObject(interior);
  assert(bounds.min.y >= 0, 'No geometry below the foundation');
  assert(bounds.max.y < 2.21);
  for (const settings of [site, normalizeSettings({ ...site, roofWidth: .84, roofHeight: .82 })]) {
    const roof = createRoofProfile(settings), floor = createFloorOutline(settings, roof);
    const seats = interior.getObjectByName('Individual blue seats');
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    for (let i = 0; i < seats.count; i++) {
      seats.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      assert(polygonContains(floor, position.x, position.z), 'Seats remain on the slab');
      assert(position.y + .08 < roof.height(position.x / settings.roofWidth, position.z) * settings.roofHeight,
        'Upper seats must not break through the roof');
    }
  }
});

test('stadium detail is finite, batched and bounded for the homepage', () => {
  const { interior } = createStadiumInterior(THREE);
  let draws = 0, triangles = 0;
  interior.traverse(object => {
    if (!object.geometry) return;
    draws++;
    for (const attribute of Object.values(object.geometry.attributes)) {
      assert([...attribute.array].every(Number.isFinite), `Invalid geometry: ${object.name}`);
    }
    if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
    if (object.isInstancedMesh) assert([...object.instanceMatrix.array].every(Number.isFinite));
  });
  assert(draws <= 24, `Draw budget: ${draws}`);
  assert(triangles < 230000, `Triangle budget: ${triangles}`);
  assert(interior.userData.seatCount > 5000 && interior.userData.seatCount < 7000);
});

test('video board has a real central opening and terrace surfaces face upward', () => {
  const { interior } = createStadiumInterior(THREE);
  interior.updateMatrixWorld(true);
  const frame = interior.getObjectByName('Infinity Screen frame');
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 4, -2.2), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(frame).length, 0, 'The field remains visible through the screen');
  ray.ray.origin.x = 1.75;
  assert(ray.intersectObject(frame).length > 0, 'The opening is bounded by a physical screen frame');
  const normals = interior.getObjectByName('Continuous seating terraces').geometry.attributes.normal;
  for (let i = 0; i < normals.count; i++) assert(normals.getY(i) > .99, 'Treads must receive light from above');
  const pitch = interior.getObjectByName('Playing field');
  assert.equal(pitch.position.y, .06);
  assert(Math.abs(pitch.geometry.parameters.width / pitch.geometry.parameters.height - 53.333 / 120) < .001);
});

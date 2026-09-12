import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { frameStadiumCamera } from '../assets/stadium-framing.js';

function setup(width, height) {
  const camera = new THREE.PerspectiveCamera(40, width / height, .1, 150);
  camera.position.set(19.5, 19, 28);
  camera.lookAt(1.65, .4, -.5);
  camera.updateMatrixWorld();
  const parent = new THREE.Group();
  parent.position.set(2, 1, -1);
  parent.rotation.y = 1.5;
  parent.scale.set(.87, .82, 1);
  const surface = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 22));
  parent.add(surface);
  parent.updateMatrixWorld(true);
  return { camera, surfaces: [surface] };
}

function bounds(camera, surfaces) {
  const box = new THREE.Box2();
  for (const surface of surfaces) {
    const positions = surface.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i)
        .applyMatrix4(surface.matrixWorld).project(camera);
      box.expandByPoint(new THREE.Vector2(p.x, p.y));
    }
  }
  return box;
}

test('centers the transformed building and enlarges it without clipping', () => {
  for (const [width, height] of [[640, 520], [440, 660], [900, 350]]) {
    const { camera, surfaces } = setup(width, height);
    const before = bounds(camera, surfaces).getSize(new THREE.Vector2());
    frameStadiumCamera(THREE, camera, surfaces, width, height);
    const after = bounds(camera, surfaces);
    assert(after.getCenter(new THREE.Vector2()).length() < 1e-10);
    const size = after.getSize(new THREE.Vector2());
    assert(size.x <= 1.68 + 1e-10 && size.y <= 1.68 + 1e-10);
    assert(Math.abs(size.x / before.x - Math.min(1.28, 1.68 / before.x, 1.68 / before.y)) < 1e-10);
  }
});

test('repeated resize and reset framing does not accumulate zoom or offsets', () => {
  const { camera, surfaces } = setup(640, 520);
  frameStadiumCamera(THREE, camera, surfaces, 640, 520);
  const initial = camera.projectionMatrix.clone();
  frameStadiumCamera(THREE, camera, surfaces, 640, 520);
  assert.deepEqual(camera.projectionMatrix.elements, initial.elements);
  camera.aspect = 440 / 660;
  frameStadiumCamera(THREE, camera, surfaces, 440, 660);
  camera.aspect = 640 / 520;
  frameStadiumCamera(THREE, camera, surfaces, 640, 520);
  assert.deepEqual(camera.projectionMatrix.elements, initial.elements);
});

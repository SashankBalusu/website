// Frame the building's projected surfaces, excluding detached lightning and
// empty canvas space. The editor keeps its independent working camera.
export function frameStadiumCamera(THREE, camera, surfaces, width, height) {
  camera.zoom = 1;
  camera.clearViewOffset();
  camera.updateMatrixWorld();
  const point = new THREE.Vector3();
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const surface of surfaces) {
    surface.updateWorldMatrix(true, false);
    const positions = surface.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(surface.matrixWorld).project(camera);
      left = Math.min(left, point.x); right = Math.max(right, point.x);
      bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
    }
  }
  // Enlarge by 28%, while retaining at least 8% clearance on each side at
  // narrower desktop widths. Shift the projection to center the actual shell
  // and foundation; moving only the canvas would preserve their optical offset.
  const zoom = Math.min(1.28, 1.68 / (right - left), 1.68 / (top - bottom));
  camera.zoom = zoom;
  camera.setViewOffset(width, height,
    (left + right) * zoom * width / 4,
    -(bottom + top) * zoom * height / 4, width, height);
}

// A compact foundation outline, not a surrounding landscape. Work in model
// coordinates so the floor follows canopy width/sweep but never roof height.
export const FLOOR_MARGIN = .28;
export const FLOOR_TOP = -.01;
export const FLOOR_DEPTH = .14;
export const FLOOR_BEVEL = .015;

function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = samples => {
    const result = [];
    for (const point of samples) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.slice().reverse())];
}

export function createFloorOutline(settings, profile) {
  const points = [];
  for (let i = 0; i < 128; i++) {
    const u = i / 128, angle = u * Math.PI * 2;
    // Include the upper curl as well as its tucked-under landing points.
    for (const radius of [.78, .9, 1]) {
      const [x, , z] = profile.deform(profile.radialPoint(u, radius));
      points.push([x * settings.roofWidth, z]);
    }
    // The interior isn't scaled with the canopy: don't trim its concourses.
    points.push([4.48 * Math.sin(angle), -2.2 + 5.63 * Math.cos(angle)]);
  }
  // Include the small stairs flanking the theater, including their rotated
  // corners, so they always land on the floor when the tail is swept sideways.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const localZ = profile.tailZ(3.9 + i * .2);
    const [x, z] = profile.sweep(side * 2.85, localZ), yaw = profile.tailYaw(localZ);
    for (const dx of [-.475, .475]) for (const dz of [-.11, .11]) {
      points.push([(x + dx * Math.cos(yaw) + dz * Math.sin(yaw)) * settings.roofWidth,
        z - dx * Math.sin(yaw) + dz * Math.cos(yaw)]);
    }
  }
  // A small round offset gives a consistent lip without sharp miter spikes.
  const hull = convexHull(points);
  return convexHull(hull.flatMap(([x, z]) => Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8;
    return [x + FLOOR_MARGIN * Math.cos(angle), z + FLOOR_MARGIN * Math.sin(angle)];
  })));
}

// Pure roof geometry, shared by the renderer and shape regression tests.
// Glazing and the solid tail share a seam within one swept canopy.
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = value => ((value % 1) + 1) % 1;

function bezier(points, t) {
  const s = 1 - t, weights = [s ** 3, 3 * s * s * t, 3 * s * t * t, t ** 3];
  return points[0].map((_, axis) => points.reduce((sum, point, i) => sum + point[axis] * weights[i], 0));
}

// A cubic radial-basis loft interpolates the canopy control points as one
// smooth sheet. Unlike radial edge falloff, it does not propagate each low
// corner inward as a separate groove. Coordinates are normalized for stability.
function sheetHeight(points) {
  const nodes = points.map(([x, y, z]) => [x / 6, z / 10, y]);
  const count = nodes.length, size = count + 3;
  const rows = Array.from({ length: size }, () => new Float64Array(size + 1));
  const kernel = (x, z) => { const square = x * x + z * z; return square * Math.sqrt(square); };
  for (let i = 0; i < count; i++) {
    const [x, z, y] = nodes[i];
    for (let j = 0; j < count; j++) rows[i][j] = kernel(x - nodes[j][0], z - nodes[j][1]);
    rows[i][i] += 1e-9;
    [1, x, z].forEach((value, j) => { rows[i][count + j] = value; rows[count + j][i] = value; });
    rows[i][size] = y;
  }
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    if (Math.abs(rows[pivot][col]) < 1e-12) throw new Error('Canopy control points are degenerate.');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= size; j++) rows[col][j] /= divisor;
    for (let row = col + 1; row < size; row++) {
      const factor = rows[row][col];
      for (let j = col; j <= size; j++) rows[row][j] -= factor * rows[col][j];
    }
  }
  const weights = new Float64Array(size);
  for (let i = size - 1; i >= 0; i--) {
    weights[i] = rows[i][size];
    for (let j = i + 1; j < size; j++) weights[i] -= rows[i][j] * weights[j];
  }
  return (x, z) => {
    x /= 6; z /= 10;
    let y = weights[count] + weights[count + 1] * x + weights[count + 2] * z;
    for (let i = 0; i < count; i++) y += weights[i] * kernel(x - nodes[i][0], z - nodes[i][1]);
    return y;
  };
}

export function polygonContains(polygon, x, z) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Exact segment intersections keep the square panel grid inside the glazing
// and out of the opaque tail, even when either outline changes in the editor.
export function clipPanelLine(polygon, hole, axis, value) {
  const other = 1 - axis, cuts = [];
  for (const loop of [polygon, hole]) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      if ((a[axis] > value) !== (b[axis] > value)) {
        cuts.push(lerp(a[other], b[other], (value - a[axis]) / (b[axis] - a[axis])));
      }
    }
  }
  cuts.sort((a, b) => a - b);
  const point = coordinate => axis === 0 ? [value, coordinate] : [coordinate, value];
  const segments = [];
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] < 1e-7) continue;
    const middle = point((cuts[i] + cuts[i - 1]) / 2);
    if (polygonContains(polygon, ...middle) && !polygonContains(hole, ...middle)) {
      segments.push([point(cuts[i - 1]), point(cuts[i])]);
    }
  }
  return segments;
}

export function createRoofProfile(settings) {
  const centerZ = -2.1, frontZ = -8.35;
  const tailZ = z => z <= 4.3 ? z : 4.3 + (z - 4.3) * settings.tailLength;
  // The HKS roof plan sweeps toward a point beside the bowl, rather than
  // tapering down its centerline. Carry the sheet sideways progressively from
  // the widest station. Rotating its cross-sections here pinched the concave
  // side and hooked the opposite edge into a blunt, almost horizontal tip.
  // A shear preserves each section's width and the long diagonal outline.
  const sweepStart = centerZ;
  function spine(z) {
    if (z <= sweepStart) return { x: 0, dx: 0, ddx: 0 };
    const length = sweepEnd - sweepStart;
    const slope = 2 * settings.tailOffset / length;
    if (z >= sweepEnd) return { x: settings.tailOffset + (z - sweepEnd) * slope, dx: slope, ddx: 0 };
    const t = (z - sweepStart) / length;
    return { x: settings.tailOffset * t * t, dx: slope * t, ddx: slope / length };
  }
  // Fronts of the theater and stair treads follow the sheet's transverse
  // sections. Those sections remain parallel as the longitudinal axis bends.
  function tailYaw() { return 0; }
  function sweep(x, z) {
    return [x + spine(z).x, z];
  }
  function unsweep(x, z) {
    // Exact inverse, including the extended tail and either sweep direction.
    // The positive unit Jacobian cannot fold the roof over itself in plan.
    return [x - spine(z).x, z];
  }
  const taper = settings.shoulderTaper;
  const frontHalfWidth = 4.4;
  const right = [
    [0, .25, [[0,9.9],[lerp(3.05,1.8,taper),8.25],[lerp(6.45,5.85,taper),2.7],[5.85,-2.1]]],
    [.25, .375, [[5.85,-2.1],[5.8,-4.7],[4.9,-7.2],[frontHalfWidth,frontZ]]],
    // The front rim lies on one plane in plan. Bowing its middle forward
    // produced a projecting ledge where the diagonal meets the upper span.
    [.375, .5, [[frontHalfWidth,frontZ],[3.35,frontZ],[1.78,frontZ],[0,frontZ]]],
  ];
  const spans = [...right, ...right.slice().reverse().map(([start, end, points]) =>
    [1 - end, 1 - start, points.slice().reverse().map(([x, z]) => [-x, z])])]
    .map(([start, end, points]) => ({ start, end, points: points.map(([x, z]) => [x, tailZ(z)]) }));
  // Elevation is independent of the plan curves: the long side rises from
  // the tail into a broad, almost level span, then curls down near the prong.
  // Interpolating height with the plan's cubic handles made the whole opening
  // a continuous arch. The front also has independent returns, not two mirrored
  // quarter arches. Positive frontAsymmetry sweeps the -X wing (right when
  // facing the front); a negative value mirrors it without changing the tail.
  const frontAmount = Math.abs(settings.frontAsymmetry);
  const frontDirection = Math.sign(settings.frontAsymmetry) || 1;
  function planEdge(u) {
    const span = spans.find(item => u <= item.end + 1e-8) || spans.at(-1);
    let [x, z] = bezier(span.points, clamp((u - span.start) / (span.end - span.start), 0, 1));
    // Keep the long wing's outward reach and the short end's inward curl
    // independent. The width control scales their shared architecture.
    const wingU = frontDirection > 0 ? .625 : .375;
    const distance = Math.abs(u - wingU) / .125;
    const extension = distance < 1 ? Math.cos(distance * Math.PI / 2) ** 4 * frontAmount : 0;
    x -= frontDirection * 1.9 * extension;
    return [x, z];
  }
  const frontStation = u => frontDirection > 0 ? 1 - u : u;
  const wingX = planEdge(frontStation(.375))[0];
  // One continuous asymmetric arch runs from the long wing through the crest.
  // A straight line joined to an ellipse is tangent but changes curvature
  // abruptly; that join read as a stiff ramp with a rounded lump on its end.
  const wingReach = Math.abs(wingX);
  const shoulderCenter = -1.1;
  const returnPower = (frontHalfWidth + shoulderCenter) / (wingReach - shoulderCenter);
  const crestT = 1 / (1 + returnPower);
  const archPeak = crestT * (1 - crestT) ** returnPower;
  const shoulderRise = 2.64;
  function edgeHeight(u) {
    const station = Math.min(u, 1 - u);
    if (station <= .25) {
      const t = station / .25;
      return lerp(.24, 2.83, 1 - (1 - t) ** 2.4);
    }
    if (station <= .375) {
      const t = (station - .25) / .125;
      const wingSide = (u > .5 ? 1 : -1) === frontDirection;
      // The approaching side must descend with the wing too. Keeping this
      // side high until the tip made the front look folded, even after skewing it.
      const descent = lerp(t ** 4, t ** 1.5, wingSide ? frontAmount : 0);
      return lerp(2.83, .24, descent);
    }
    const symmetricT = (station - .375) / .125;
    const symmetric = lerp(.24, 2.88, 1 - (1 - symmetricT) ** 6);
    const x = -frontDirection * planEdge(u)[0];
    const t = clamp((wingReach - x) / (wingReach + frontHalfWidth), 0, 1);
    const asymmetric = .24 + shoulderRise * t * (1 - t) ** returnPower / archPeak;
    return lerp(symmetric, asymmetric, frontAmount);
  }
  function rawEdge(u) {
    const [x, z] = planEdge(u);
    return [x, edgeHeight(u), z];
  }
  function softenedEdge(u) {
    u = wrap(u);
    const point = [0, 0, 0], weights = [1, 4, 6, 4, 1];
    weights.forEach((weight, i) => {
      const sample = rawEdge(wrap(u + (i - 2) * settings.cornerSoftness));
      sample.forEach((value, axis) => { point[axis] += value * weight / 16; });
    });
    return point;
  }
  // Easing two different slopes otherwise lifts the short, steep end more
  // than the diagonal wing. Give the softened tips one shared landing height,
  // feathering the correction through the nearby rim rather than adding a step.
  const tips = [.375, .625].map(u => ({ u, point: softenedEdge(u) }));
  const landingY = Math.min(...tips.map(tip => tip.point[1]));
  function localEdge(u) {
    const point = softenedEdge(u);
    const radius = .02 + 2 * settings.cornerSoftness;
    for (const tip of tips) {
      const distance = Math.abs(wrap(u) - tip.u) / radius;
      if (distance < 1) point[1] -= (tip.point[1] - landingY) * (1 - distance ** 2) ** 3;
    }
    return point;
  }
  function edge(u) {
    const [x, , z] = localEdge(u);
    const p = sweep(x, z);
    return [p[0], localHeight(x, z), p[1]];
  }
  const sweepEnd = localEdge(0)[2];

  // An angular lookup makes every layer sample the same continuous height
  // field. In particular the oval does not dictate where the roof rolls down.
  const edgeSamples = Array.from({ length: 513 }, (_, i) => {
    const point = localEdge(i / 512);
    return { angle: i === 0 ? 0 : i === 512 ? TAU : (Math.atan2(point[0], point[2] - centerZ) + TAU) % TAU, point };
  });
  function boundaryAt(x, z) {
    const angle = (Math.atan2(x, z - centerZ) + TAU) % TAU;
    let lo = 0, hi = edgeSamples.length - 1;
    while (hi - lo > 1) {
      const mid = (hi + lo) >> 1;
      if (edgeSamples[mid].angle < angle) lo = mid; else hi = mid;
    }
    const a = edgeSamples[lo], b = edgeSamples[hi];
    const mix = (angle - a.angle) / (b.angle - a.angle);
    return a.point.map((value, axis) => lerp(value, b.point[axis], mix));
  }
  const crownHeight = (x, z) => 3.24 - .009 * x * x - .004 * (z - centerZ) ** 2 + .018 * x
    + settings.crown * (1 - (x / 5.25) ** 2 - ((z - centerZ) / 6.4) ** 2);
  const sheetCrown = (x, z) => crownHeight(x, z) - .018 * x;
  const loftStations = new Set(Array.from({ length: 48 }, (_, i) => i / 48));
  for (const tip of [.375, .625]) {
    loftStations.add(tip - settings.cornerSoftness);
    loftStations.add(tip + settings.cornerSoftness);
  }
  const loftPoints = [...loftStations].map(localEdge);
  loftPoints.push([0, sheetCrown(0, centerZ), centerZ]);
  const innerRadius = lerp(.43, .62, (settings.roundness - 1) / 1.6);
  for (let i = 0; i < 12; i++) {
    const p = localEdge(i / 12);
    const x = p[0] * innerRadius, z = centerZ + (p[2] - centerZ) * innerRadius;
    loftPoints.push([x, sheetCrown(x, z), z]);
  }
  const loftHeight = sheetHeight(loftPoints);
  function localHeight(x, z) {
    const boundary = boundaryAt(x, z);
    const radius = Math.hypot(x, z - centerZ) / Math.hypot(boundary[0], boundary[2] - centerZ);
    // Keep the tight return near the edge, but let the opposite wing roll
    // gradually through the film. Both blend into the unchanged rear sweep.
    const front = clamp((centerZ - z) / 4, 0, 1);
    const tightSide = clamp((1.5 + x * frontDirection) / 3, 0, 1);
    const frontRoll = lerp(.74, lerp(.62, .70, tightSide * tightSide * (3 - 2 * tightSide)), frontAmount);
    const rollStart = lerp(.55, frontRoll, front * front * (3 - 2 * front));
    const shoulder = clamp((radius - rollStart) / (1 - rollStart), 0, 1);
    const eased = (shoulder * shoulder * (3 - 2 * shoulder)) ** settings.roundness;
    const rearHeight = crownHeight(x, z) + (boundary[1] - crownHeight(boundary[0], boundary[2])) * eased;
    // Keep the established tail untouched. The whole front half transitions
    // into the loft together, so its sides, glazing, rim and supports agree.
    const frontMix = front * front * (3 - 2 * front);
    if (!frontMix) return rearHeight;
    // Cubic interpolation can overshoot between closely spaced rim controls.
    // A smooth ceiling keeps the sheet beneath its shallow crown, without
    // introducing a hard clamp/crease or artificial humps beside the returns.
    const ceiling = sheetCrown(x, z), gap = ceiling - loftHeight(x, z), margin = .06;
    const drop = gap >= margin ? gap : gap <= -margin ? 0 : (gap + margin) ** 2 / (4 * margin);
    return lerp(rearHeight, ceiling - drop, frontMix);
  }
  function height(x, z) { return localHeight(...unsweep(x, z)); }
  // The sheet above is a material-coordinate surface, not the final projection.
  // Folding its low end back in 3D lets it pass underneath the upper sheet;
  // a single-valued world-space height field cannot represent the overhanging return.
  const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  function deform([x, y, z]) {
    if (z >= -5.2 || y >= 2.2 || settings.cornerReturn === 0) return [x, y, z];
    const side = Math.sign(x);
    const sideAmount = side === frontDirection ? 1 : 1 - frontAmount;
    const corner = ease((Math.abs(x) - 2.8) / 2) * ease((-z - 5.2) / 2.7);
    const t = clamp((2.2 - y) / 1.95, 0, 1);
    // A restrained S return: inward through the waist, then opening back out
    // into its footing. Both ends have zero first and second derivatives, so
    // this blends into the upper sheet without a kink or a pinched hook.
    const tuck = .2 * t ** 3 * (10 - 15 * t + 6 * t * t);
    const waist = .95 * 64 * t ** 3 * (1 - t) ** 3;
    const turn = settings.cornerReturn * sideAmount * corner * (tuck + waist);
    // Curl across the front elevation only: a depth translation would pull
    // this tip behind the opposite wing and misalign their foundations.
    return [x - side * 1.25 * turn, y, z];
  }
  function surfaceNormal(x, z) {
    const e = .003;
    const xp = deform([x + e, height(x + e, z), z]), xm = deform([x - e, height(x - e, z), z]);
    const zp = deform([x, height(x, z + e), z + e]), zm = deform([x, height(x, z - e), z - e]);
    const dx = xp.map((value, i) => value - xm[i]), dz = zp.map((value, i) => value - zm[i]);
    const normal = [dz[1] * dx[2] - dz[2] * dx[1], dz[2] * dx[0] - dz[0] * dx[2], dz[0] * dx[1] - dz[1] * dx[0]];
    const length = Math.hypot(...normal);
    return normal.map(value => value / length);
  }
  function surfacePoint(x, z, offset = 0) {
    const point = deform([x, height(x, z), z]);
    if (!offset) return point;
    const normal = surfaceNormal(x, z);
    return point.map((value, i) => value + offset * normal[i]);
  }
  function radialPoint(u, radius) {
    const boundary = localEdge(u);
    const x = boundary[0] * radius, z = centerZ + (boundary[2] - centerZ) * radius;
    return roofPointAt(x, z);
  }
  function roofPointAt(x, z) {
    const p = sweep(x, z);
    return [p[0], localHeight(x, z), p[1]];
  }
  const filmScale = .94 * settings.filmSize;
  function glazingScale(u) {
    // The low corners are solid apron panels, not glazing folded down into
    // vertical walls. Feather their width into the otherwise narrow rim.
    const corner = Math.min(Math.abs(u - .375), Math.abs(u - .625)) / .11;
    const apron = corner < 1 ? .14 * Math.cos(corner * Math.PI / 2) ** 4 : 0;
    return filmScale - apron;
  }
  // The narrow return changes height quickly. Extra longitudinal and radial
  // samples keep its actual silhouette and reflective skin smooth at close range.
  const bodySegments = 384, seamSegments = 64, radialSegments = 48, filmSegments = bodySegments + seamSegments;
  const join = lerp(.14, .09, settings.plazaGlazing);
  function localEnvelope(u) {
    const p = localEdge(u);
    const scale = glazingScale(u);
    return [p[0] * scale, centerZ + (p[2] - centerZ) * scale];
  }
  const leftJoin = localEnvelope(1 - join), rightJoin = localEnvelope(join);
  const seamControls = [leftJoin,
    [lerp(leftJoin[0], rightJoin[0], 1 / 3), leftJoin[1] + 1.6 * filmScale * settings.tailLength],
    [lerp(leftJoin[0], rightJoin[0], 2 / 3), rightJoin[1] + 1.6 * filmScale * settings.tailLength], rightJoin];
  const localSeam = t => bezier(seamControls, t);
  const seamPoint = t => roofPointAt(...localSeam(t));
  const tailEdge = t => localEdge(1 - join + 2 * join * t);
  function perimeterPoint(u, t) {
    const station = join + (1 - 2 * join) * u;
    return radialPoint(station, lerp(glazingScale(station), 1, t));
  }
  function tailSurface(u, t) {
    const inner = localSeam(u), outer = tailEdge(u);
    return roofPointAt(lerp(inner[0], outer[0], t), lerp(inner[1], outer[2], t));
  }

  // The film actually ends at the seam; no glazing hides beneath an overlaid
  // triangle. Both sheets use exactly the same seam vertices and heights.
  const localFilm = Array.from({ length: bodySegments + 1 }, (_, i) => localEnvelope(join + (1 - 2 * join) * i / bodySegments));
  for (let i = 1; i < seamSegments; i++) localFilm.push(localSeam(i / seamSegments));
  function filmPoint(u, radius = 1) {
    const index = wrap(u) * filmSegments, i = Math.floor(index), t = index - i;
    const a = localFilm[i], b = localFilm[(i + 1) % filmSegments];
    return roofPointAt(lerp(a[0], b[0], t) * radius, centerZ + (lerp(a[1], b[1], t) - centerZ) * radius);
  }
  const worldXZ = ([x, z]) => sweep(x, z);
  const filmPolygon = localFilm.map(worldXZ);
  const tailPolygon = Array.from({ length: seamSegments + 1 }, (_, i) => {
    const p = tailEdge(i / seamSegments); return worldXZ([p[0], p[2]]);
  });
  for (let i = seamSegments; i >= 0; i--) tailPolygon.push(worldXZ(localSeam(i / seamSegments)));

  // Distance along a ray to the actual glazed outline (including its new seam).
  // This also handles the swept, asymmetric boundary when fitting the oval.
  function glazedRadius(x, z) {
    const length = Math.hypot(x, z - centerZ), dx = x / length, dz = (z - centerZ) / length;
    let distance = Infinity;
    for (let i = 0; i < filmPolygon.length; i++) {
      const a = filmPolygon[i], b = filmPolygon[(i + 1) % filmPolygon.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], cross = dx * ez - dz * ex;
      if (Math.abs(cross) < 1e-9) continue;
      const r = (a[0] * ez - (a[1] - centerZ) * ex) / cross;
      const t = (a[0] * dz - (a[1] - centerZ) * dx) / cross;
      if (r > 0 && t >= 0 && t <= 1) distance = Math.min(distance, r);
    }
    return distance;
  }

  // Auto-fit the independent ellipse inside the glazing at slider extremes.
  let ovalRX = 4.65 * settings.ovalWidth, ovalRZ = 6.25 * settings.ovalLength;
  let fit = 1;
  for (let i = 0; i < 128; i++) {
    const angle = i / 128 * TAU;
    const x = ovalRX * Math.sin(angle), z = centerZ + ovalRZ * Math.cos(angle);
    fit = Math.min(fit, (glazedRadius(x, z) - .18) / Math.hypot(x, z - centerZ));
  }
  ovalRX *= fit; ovalRZ *= fit;
  function ovalPoint(u, inset = 0) {
    const angle = u * TAU;
    const x = (ovalRX - inset) * Math.sin(angle), z = centerZ + (ovalRZ - inset) * Math.cos(angle);
    return [x, height(x, z), z];
  }
  // Clip/fill in material coordinates, then deform all consumers together.
  // In particular, the folded lip is not a second mesh pasted over the rim.
  return { centerZ, frontZ, tailZ, sweep, unsweep, tailYaw, sweepStart, sweepEnd, edge, height, deform, surfaceNormal, surfacePoint, radialPoint, filmPoint, filmScale, filmPolygon,
    bodySegments, seamSegments, radialSegments, filmSegments, perimeterPoint, seamPoint, tailSurface, tailPolygon, ovalPoint, ovalRX, ovalRZ,
    panelSegments: (axis, value) => clipPanelLine(filmPolygon, [], axis, value),
    // Keep supports aligned with the same surface, not with the decorative oval.
    roofPoint: (u, t) => radialPoint(u, .58 + .42 * t),
  };
}

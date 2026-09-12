// Original, instanced architectural detail. No DOM or renderer dependency.
const TAU = Math.PI * 2;
const CENTER_Z = -2.2;

// The pitch has straight sidelines; successive seating tiers become more oval.
export function bowlPoint(angle, spread) {
  const exponent = 2 / (3.25 - spread * 1.05);
  const signed = value => Math.sign(value) * Math.abs(value) ** exponent;
  return [(1.75 + 2.22 * spread) * signed(Math.sin(angle)),
    CENTER_Z + (3.12 + 2.04 * spread) * signed(Math.cos(angle))];
}

export const SEATING_TIERS = Object.freeze([
  { rows: 13, start: .015, end: .43, base: .16, rise: .034 },
  { rows: 7, start: .49, end: .68, base: .77, rise: .037 },
  { rows: 12, start: .74, end: 1, base: 1.17, rise: .041 },
]);
export const ENTRY_PORTAL = Object.freeze({ start: 2.61, end: 3.67, spread: 1.075, height: .68 });

export function createStadiumInterior(THREE, { fieldTexture = null, boardTexture = null } = {}) {
  const interior = new THREE.Group();
  interior.name = 'Stadium interior';
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, side: THREE.DoubleSide, ...extra });
  const concrete = mat('#b9b9b1');
  const terrace = mat('#d4d2c8');
  const recess = mat('#34434a');
  const steel = mat('#d9dedd', { metalness: .3, roughness: .52 });
  const glazing = mat('#304957', { metalness: .38, roughness: .26 });
  const blueLight = mat('#b9e3ef', { map: boardTexture, emissiveMap: boardTexture,
    emissive: '#ffffff', emissiveIntensity: .35, roughness: .5, side: THREE.DoubleSide });
  const ribbon = mat('#338dbb', { emissive: '#249ad1', emissiveIntensity: .3 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map();
  const dummy = new THREE.Object3D();
  const sections = 32;

  function add(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    interior.add(mesh);
    return mesh;
  }
  function box(material, x, y, z, width, height, depth, yaw = 0) {
    if (!batches.has(material)) batches.set(material, []);
    dummy.position.set(x, y, z); dummy.scale.set(width, height, depth);
    dummy.rotation.set(0, yaw, 0); dummy.updateMatrix();
    batches.get(material).push(dummy.matrix.clone());
  }
  function geometryFrom(positions, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }
  function quad(positions, a, b, c, d) { positions.push(...a, ...b, ...d, ...b, ...c, ...d); }
  function strip(positions, inner, outer, y, height = 0, start = 0, end = TAU) {
    const count = Math.ceil(192 * (end - start) / TAU);
    for (let i = 0; i < count; i++) {
      const a = start + (end - start) * i / count, b = start + (end - start) * (i + 1) / count;
      const p = bowlPoint(a, inner), q = bowlPoint(b, inner);
      const r = bowlPoint(b, outer), s = bowlPoint(a, outer);
      quad(positions, [p[0], y, p[1]], [s[0], y + height, s[1]], [r[0], y + height, r[1]], [q[0], y, q[1]]);
    }
  }
  function wall(positions, spread, bottom, top, start = 0, end = TAU) {
    strip(positions, spread, spread, bottom, top - bottom, start, end);
  }

  const floor = new THREE.Shape();
  floor.absellipse(0, -CENTER_Z, 4.1, 5.35, 0, TAU, false);
  const floorGeo = new THREE.ShapeGeometry(floor, 96);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = add(floorGeo, recess, 'Bowl floor'); floorMesh.position.y = .005;
  const pitch = add(new THREE.PlaneGeometry(2.8, 6.3), mat('#ffffff', { map: fieldTexture }), 'Playing field');
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, .06, CENTER_Z);

  const treads = [], risers = [], suites = [], fascias = [], ribbons = [];
  const seatMaterial = mat('#ffffff', { roughness: .72 });
  const seats = [];
  const seatColors = [];
  const palette = ['#305774', '#3d6380', '#466b88', '#31516b', '#5d7c92'].map(color => new THREE.Color(color));
  const stepMaterial = mat('#ced0c9');
  let rowId = 0;
  for (const tier of SEATING_TIERS) {
    const run = (tier.end - tier.start) / tier.rows;
    for (let row = 0; row < tier.rows; row++, rowId++) {
      const inside = tier.start + row * run, outside = inside + run;
      const y = tier.base + row * tier.rise;
      strip(treads, inside, outside, y);
      wall(risers, inside, y - tier.rise, y);
      const spread = inside + run * .56;
      for (let section = 0; section < sections; section++) {
        const a = (section + .1) / sections * TAU, b = (section + .9) / sections * TAU;
        const first = bowlPoint(a, spread), last = bowlPoint(b, spread);
        const count = Math.max(3, Math.floor(Math.hypot(last[0] - first[0], last[1] - first[1]) / .088));
        for (let seat = 0; seat < count; seat++) {
          const angle = a + (b - a) * (seat + .5) / count;
          const [x, z] = bowlPoint(angle, spread);
          const next = bowlPoint(angle + .001, spread);
          const yaw = -Math.atan2(next[1] - z, next[0] - x);
          dummy.rotation.set(0, yaw, 0);
          dummy.position.set(x, y + .032, z); dummy.scale.set(.069, .065, .065);
          dummy.updateMatrix(); seats.push(dummy.matrix.clone());
          seatColors.push(palette[(section * 7 + seat * 13 + rowId * 3) % palette.length]);
        }
        // Aisle stair treads stay continuous through every row.
        const angle = section / sections * TAU, [x, z] = bowlPoint(angle, spread);
        const next = bowlPoint(angle + .001, spread);
        box(stepMaterial, x, y + .005, z, .092, .012, .075,
          -Math.atan2(next[1] - z, next[0] - x));
      }
    }
    // Broad landings separate tiers; the dark suite fronts sit below their lips.
    if (tier.start > .1) {
      strip(fascias, tier.start - .045, tier.start + .012, tier.base - .035);
      wall(suites, tier.start - .027, tier.base - .17, tier.base - .045);
      wall(ribbons, tier.start - .04, tier.base - .033, tier.base - .01);
      for (let i = 0; i < 96; i++) {
        const angle = TAU * i / 96, [x, z] = bowlPoint(angle, tier.start - .025);
        box(steel, x, tier.base - .11, z, .014, .13, .014);
      }
    }
  }
  add(geometryFrom(treads), concrete, 'Continuous seating terraces');
  add(geometryFrom(risers), recess, 'Seating risers');
  add(geometryFrom(fascias), terrace, 'Club level balcony edges');
  add(geometryFrom(suites), glazing, 'Club level glazing');
  add(geometryFrom(ribbons), ribbon, 'Bowl LED ribbons');

  // A single L-shaped seat is reused throughout the bowl: cushion + back.
  const cushion = new THREE.BoxGeometry(1, .22, 1).toNonIndexed();
  cushion.translate(0, -.28, 0);
  const back = new THREE.BoxGeometry(1, 1, .19).toNonIndexed();
  back.translate(0, .12, .4);
  const seatGeometry = geometryFrom([...cushion.attributes.position.array, ...back.attributes.position.array]);
  cushion.dispose(); back.dispose();
  const seatMesh = new THREE.InstancedMesh(seatGeometry, seatMaterial, seats.length);
  seats.forEach((matrix, i) => { seatMesh.setMatrixAt(i, matrix); seatMesh.setColorAt(i, seatColors[i]); });
  seatMesh.name = 'Individual blue seats'; seatMesh.receiveShadow = true;
  // The terraces already cast the bowl shadow; thousands of tiny seat shadows
  // add considerable GPU work and disappear at the homepage's viewing size.
  interior.add(seatMesh);

  // Open external circulation: slab edges, recessed hospitality glazing,
  // mullions and guardrails. The ends remain open to the covered plaza.
  const concourses = [], concourseEdges = [], outerGlass = [], rails = [];
  for (const [start, end] of [[.28, 2.86], [3.42, 6]]) {
    for (const y of [.64, 1.08, 1.62]) {
      strip(concourses, .94, 1.13, y, 0, start, end);
      wall(concourseEdges, 1.13, y - .055, y, start, end);
      if (y < 1.5) wall(outerGlass, 1.015, y + .015, y + .24, start, end);
      for (let i = 0; i <= 48; i++) {
        const a = start + (end - start) * i / 48;
        const [x, z] = bowlPoint(a, 1.11);
        const [gx, gz] = bowlPoint(a, 1.019);
        box(steel, x, y + .066, z, .012, .132, .012);
        if (y < 1.5) box(steel, gx, y + .13, gz, .018, .25, .018);
        if (i > 0) {
          const [px, pz] = bowlPoint(start + (end - start) * (i - 1) / 48, 1.11);
          rails.push(px, y + .13, pz, x, y + .13, z);
        }
      }
      for (let i = 0; i <= 12; i++) {
        const [x, z] = bowlPoint(start + (end - start) * i / 12, 1.07);
        box(concrete, x, y / 2, z, .06, y, .07);
      }
    }
  }
  add(geometryFrom(concourses), terrace, 'Open concourse decks');
  add(geometryFrom(concourseEdges), concrete, 'Concourse slab edges');
  add(geometryFrom(outerGlass), glazing, 'Recessed hospitality windows');
  const railGeometry = new THREE.BufferGeometry();
  railGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rails, 3));
  const railMesh = new THREE.LineSegments(railGeometry, new THREE.LineBasicMaterial({ color: '#bcc9ca' }));
  railMesh.name = 'Concourse guardrails'; interior.add(railMesh);

  // A recessed, curved entrance sits behind the front colonnade. Real door
  // bays and a shallow lintel break up the exposed dark end of the bowl.
  const entryPanes = [], entryHeader = [], entryLanding = [];
  const { start: entryStart, end: entryEnd, spread: entrySpread, height: entryHeight } = ENTRY_PORTAL;
  wall(entryPanes, entrySpread, .045, entryHeight - .065, entryStart, entryEnd);
  wall(entryHeader, 1.15, entryHeight - .055, entryHeight, entryStart, entryEnd);
  strip(entryHeader, entrySpread, 1.15, entryHeight, 0, entryStart, entryEnd);
  strip(entryLanding, 1.03, 1.18, .022, 0, entryStart, entryEnd);
  add(geometryFrom(entryPanes), glazing, 'Recessed glazed entrance doors');
  add(geometryFrom(entryHeader), terrace, 'Front entrance lintel');
  add(geometryFrom(entryLanding), terrace, 'Entrance landing');
  for (let i = 0; i <= 16; i++) {
    const angle = entryStart + (entryEnd - entryStart) * i / 16;
    const [x, z] = bowlPoint(angle, entrySpread + .006);
    box(steel, x, .33, z, .018, .58, .018);
    if (i < 16) {
      const [hx, hz] = bowlPoint(angle + (entryEnd - entryStart) / 32, entrySpread + .012);
      box(steel, hx, .3, hz, .008, .14, .008);
    }
  }

  // Dual-sided Infinity Screen, with a genuine opening and a dark underside.
  const screenPositions = [], screenUV = [], screenFrame = [];
  const boardBottom = 1.89, boardHeight = .3;
  for (let i = 0; i < 160; i++) {
    const a = i / 160 * TAU, b = (i + 1) / 160 * TAU;
    const point = (angle, inset, y) => [(1.79 - inset) * Math.sin(angle), y,
      CENTER_Z + (2.95 - inset) * Math.cos(angle)];
    for (const inset of [0, .095]) {
      quad(screenPositions, point(a, inset, boardBottom), point(b, inset, boardBottom),
        point(b, inset, boardBottom + boardHeight), point(a, inset, boardBottom + boardHeight));
      const u = i / 160 * 4, v = (i + 1) / 160 * 4;
      screenUV.push(u, 0, v, 0, u, 1, v, 0, v, 1, u, 1);
    }
    for (const y of [boardBottom - .015, boardBottom + boardHeight + .015]) {
      quad(screenFrame, point(a, 0, y), point(b, 0, y), point(b, .095, y), point(a, .095, y));
    }
  }
  const videoBoard = add(geometryFrom(screenPositions, screenUV), blueLight, 'Suspended video board');
  videoBoard.castShadow = false;
  add(geometryFrom(screenFrame), mat('#23323c', { side: THREE.DoubleSide }), 'Infinity Screen frame');

  const goal = mat('#f9c846', { roughness: .56 });
  for (const sign of [-1, 1]) {
    const z = CENTER_Z + sign * 3.03;
    box(goal, 0, .25, z + sign * .14, .019, .38, .019);
    box(goal, 0, .43, z + sign * .07, .019, .019, .16);
    box(goal, 0, .43, z, .45, .019, .019);
    for (const x of [-.225, .225]) box(goal, x, .67, z, .017, .49, .017);
  }
  for (const side of [-1, 1]) {
    for (const z of [-3.8, -2.2, -.6]) {
      box(terrace, side * 1.58, .1, z, .085, .07, .58);
      box(glazing, side * 1.62, .16, z, .025, .09, .58);
    }
  }
  for (const [material, matrices] of batches) {
    const instances = new THREE.InstancedMesh(unitBox, material, matrices.length);
    matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    instances.castShadow = true; instances.receiveShadow = true;
    interior.add(instances);
  }
  interior.userData.seatCount = seats.length;
  return { interior, blueLight, ribbon, hospitalityGlass: glazing, boardTop: boardBottom + boardHeight };
}

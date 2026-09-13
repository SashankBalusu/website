import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { DEFAULT_SETTINGS, GEOMETRY_KEYS, normalizeSettings } from './stadium-settings.js';
import { createRoofProfile } from './stadium-roof.js';
import { createFloorOutline, FLOOR_TOP, FLOOR_DEPTH, FLOOR_BEVEL } from './stadium-floor.js';
import { createLightning } from './stadium-lightning.js';
import { createStadiumInterior } from './stadium-interior.js';
import { createStadiumLighting } from './stadium-lighting.js';
import { frameStadiumCamera } from './stadium-framing.js';
import { createFieldTexture, createBoardTexture, createCladdingTexture, createFritTexture, createPavingTexture, createStadiumEnvironment } from './stadium-textures.js';

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// Low side elevation, with the theater to the left and the long foundation
// edge level, matching the chosen opening view. Keep the editor's 3/4 view.
const homeCameraPosition = [3.891, 12.276, -36.98];
const framingFov = aspect => Math.max(33, THREE.MathUtils.radToDeg(
  2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(42) / 2) / aspect)));

// An original architectural miniature based on exterior references linked in
// STADIUM.md. Dimensions are composed for the small scene, not surveying.
function buildStadium(settings) {
  const model = new THREE.Group();
  let activeGroup = model;
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra });
  const chalk = material('#eee9dc');
  const concrete = material('#c8c6b8');
  const steel = material('#e2e5df', { metalness: .28, roughness: .46 });
  const darkGlass = material('#31464c', { metalness: .3, roughness: .32, side: THREE.DoubleSide });
  const fieldTexture = createFieldTexture(THREE);
  const boardTexture = createBoardTexture(THREE);
  const { interior, blueLight, ribbon, boardTop, hospitalityGlass } = createStadiumInterior(THREE, { fieldTexture, boardTexture });
  model.add(interior);
  const warmLight = material('#fff0cc', { emissive: '#ffd6a0', emissiveIntensity: .35 });
  const coolLight = material('#c2e5ec', { emissive: '#59bada', emissiveIntensity: .2 });
  const pierMaterial = material('#dddeda', { emissive: '#25a9bf', emissiveIntensity: 0 });
  const batches = new Map();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
  const unitBall = new THREE.SphereGeometry(1, 10, 8);
  const dummy = new THREE.Object3D();

  function instance(geometry, mat, position, scale, rotation = [0, 0, 0]) {
    const key = `${geometry.uuid}:${mat.uuid}:${activeGroup.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry, mat, parent: activeGroup, matrices: [] });
    dummy.position.set(...position);
    dummy.scale.set(...scale);
    dummy.rotation.set(...rotation);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }

  function beam(a, b, radius = .025, mat = steel) {
    const key = `${unitCylinder.uuid}:${mat.uuid}:${activeGroup.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry: unitCylinder, mat, parent: activeGroup, matrices: [] });
    const delta = b.clone().sub(a);
    dummy.position.copy(a).add(b).multiplyScalar(.5);
    dummy.scale.set(radius, delta.length(), radius);
    dummy.quaternion.setFromUnitVectors(v3(0, 1, 0), delta.normalize());
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }

  function mesh(geometry, mat, position = [0, 0, 0]) {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(...position);
    item.castShadow = true;
    item.receiveShadow = true;
    activeGroup.add(item);
    return item;
  }

  // Every surface is generated from shared coordinates, keeping seams aligned.
  function surface(sample, columns, rows) {
    const positions = [], indices = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= columns; i++) positions.push(...sample(i / columns, j / rows));
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const a = j * (columns + 1) + i, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function outline(points) {
    return new THREE.CatmullRomCurve3(points.map(([x, z]) => v3(x, 0, z)), true, 'catmullrom', .25);
  }
  function shape(curve, scale = 1, center = [0, 0]) {
    return new THREE.Shape(curve.getPoints(110).map(p => new THREE.Vector2(center[0] + (p.x - center[0]) * scale, -(center[1] + (p.z - center[1]) * scale))));
  }
  function line(points, mat, closed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const item = closed ? new THREE.LineLoop(geometry, mat) : new THREE.Line(geometry, mat);
    activeGroup.add(item);
    return item;
  }
  // The canopy is a long shield, with a rounded stadium end and a tapered
  // southern tail covering the plaza and theater. It is independent of the bowl.
  const architecture = new THREE.Group();
  architecture.name = 'Editable architecture';
  architecture.scale.set(settings.roofWidth, settings.roofHeight, 1);
  model.add(architecture); activeGroup = architecture;
  const profile = createRoofProfile(settings);
  const { tailZ, sweep, tailYaw } = profile;
  // Keep a single shallow slab directly beneath the stadium. It lives in the
  // model group so canopy-height edits cannot lift it off the foundations.
  const floorOutline = createFloorOutline(settings, profile);
  const floorShape = new THREE.Shape(floorOutline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floorGeometry = new THREE.ExtrudeGeometry(floorShape, {
    depth: FLOOR_DEPTH, steps: 1, bevelEnabled: true,
    bevelThickness: FLOOR_BEVEL, bevelSize: .025, bevelSegments: 2,
  });
  floorGeometry.rotateX(-Math.PI / 2);
  floorGeometry.translate(0, FLOOR_TOP - FLOOR_DEPTH - FLOOR_BEVEL, 0);
  const pavingUV = [];
  for (let i = 0; i < floorGeometry.attributes.position.count; i++) {
    pavingUV.push(floorGeometry.attributes.position.getX(i) / 3.2,
      floorGeometry.attributes.position.getZ(i) / 3.2);
  }
  floorGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(pavingUV, 2));
  const floor = new THREE.Mesh(floorGeometry, material('#b7b9b2', { map: createPavingTexture(THREE), roughness: .94 }));
  floor.name = 'Stadium floor slab';
  floor.receiveShadow = true;
  model.add(floor);
  const roofPoint = (u, t, offset = 0) => {
    const p = profile.roofPoint(u, t);
    return profile.surfacePoint(p[0], p[2], offset);
  };
  const outerEdge = u => v3(...profile.deform(profile.edge(u)));
  const borderPoint = profile.perimeterPoint;
  const offsetRoofPoint = (p, offset) => profile.surfacePoint(p[0], p[2], offset);
  function roofSurface(sample, columns, rows) {
    const normals = [], uvs = [];
    const geometry = surface((u, t) => {
      const p = sample(u, t);
      const local = profile.unsweep(p[0], p[2]);
      uvs.push(local[0] / 1.6, local[1] / 1.6);
      // Shared 3D tangents keep adjoining materials smooth even where the
      // return passes vertical and its outer normal points down underneath.
      normals.push(...profile.surfaceNormal(p[0], p[2]));
      return profile.deform(p);
    }, columns, rows);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
  }
  const claddingTexture = createCladdingTexture(THREE);
  const silver = new THREE.MeshPhysicalMaterial({ color: '#efeee7', map: claddingTexture,
    metalness: .38, roughness: .62, clearcoat: .18, clearcoatRoughness: .48,
    side: THREE.DoubleSide });
  const roof = mesh(roofSurface(borderPoint, profile.bodySegments, profile.radialSegments), silver);
  roof.name = 'Narrow shield-shaped canopy perimeter';
  const seams = new THREE.LineBasicMaterial({ color: '#8b9491', transparent: true, opacity: .16 });
  const rimLine = new THREE.LineBasicMaterial({ color: '#d1d8d6' });
  // Broad construction joints follow the curved shell; the finer triangular
  // panelization and perforations live in its filtered material map.
  const panelLines = [];
  for (let i = 0; i < 80; i++) {
    for (let j = 0; j < 48; j++) {
      for (const t of [j / 48, (j + 1) / 48]) {
        panelLines.push(...offsetRoofPoint(borderPoint(i / 80, t), .006));
      }
    }
  }
  for (const row of [.4, .75]) {
    for (let i = 0; i < 240; i++) {
      for (const index of [i, i + 1]) {
        panelLines.push(...offsetRoofPoint(borderPoint(index / 240, row), .006));
      }
    }
  }
  const panelLineGeometry = new THREE.BufferGeometry();
  panelLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(panelLines, 3));
  activeGroup.add(new THREE.LineSegments(panelLineGeometry, seams));
  line(Array.from({ length: 721 }, (_, i) => outerEdge(i / 720)), rimLine);
  const fascia = mesh(surface((u, t) => {
    return offsetRoofPoint(profile.edge(u), -settings.rimThickness * t);
  }, 720, 4), material('#a2abad', { metalness: .38, roughness: .56, side: THREE.DoubleSide }));
  fascia.name = 'Folded aluminum fascia';
  const fasciaJoints = [];
  for (let i = 0; i < 320; i++) {
    const point = profile.edge(i / 320);
    fasciaJoints.push(...offsetRoofPoint(point, -.009), ...offsetRoofPoint(point, -settings.rimThickness + .008));
  }
  const fasciaJointGeometry = new THREE.BufferGeometry();
  fasciaJointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fasciaJoints, 3));
  const fasciaJointMesh = new THREE.LineSegments(fasciaJointGeometry, seams);
  fasciaJointMesh.name = 'Fascia panel joints'; activeGroup.add(fasciaJointMesh);
  line(Array.from({ length: 721 }, (_, i) => v3(...offsetRoofPoint(profile.edge(i / 720), -settings.rimThickness))),
    new THREE.LineBasicMaterial({ color: '#707f82', transparent: true, opacity: .55 }));

  // Printed ETFE reads as pale, light-scattering film with soft sky highlights.
  const filmTexture = createFritTexture(THREE);
  filmTexture.repeat.set(18, 22);
  const glassRoof = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: filmTexture, transparent: true, opacity: .76,
    side: THREE.DoubleSide, roughness: .36, metalness: .08,
    clearcoat: .65, clearcoatRoughness: .24, depthWrite: false,
  });
  const filmGeometry = roofSurface(profile.filmPoint, profile.filmSegments, 48);
  const filmUV = [];
  const filmPositions = filmGeometry.attributes.position;
  for (let i = 0; i < filmPositions.count; i++) {
    filmUV.push((filmPositions.getX(i) + 6) / 12, (filmPositions.getZ(i) + 9.5) / 20);
  }
  filmGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(filmUV, 2));
  const glass = mesh(filmGeometry, glassRoof);
  glass.name = 'Continuous fritted translucent roof';
  glass.castShadow = false;

  const tail = mesh(roofSurface(profile.tailSurface, profile.seamSegments, profile.radialSegments), silver);
  tail.name = 'Connected solid theater tail';

  // This is a band lying within the larger glazed field, not its boundary.
  const oval = mesh(surface((u, t) => {
    return offsetRoofPoint(profile.ovalPoint(u, t * settings.ovalBandWidth), .042);
  }, 192, 2), material('#a6b5b7', { metalness: .48, roughness: .44, side: THREE.DoubleSide }));
  oval.name = 'Independent oval roof band';
  oval.castShadow = false;
  const cables = new THREE.LineBasicMaterial({ color: '#87999c', transparent: true, opacity: .38 });
  const cablePositions = [];
  const spacing = settings.gridSpacing;
  for (const axis of [0, 1]) {
    const extent = axis === 0 ? 6 : 12;
    for (let row = -Math.ceil(extent / spacing); row <= Math.ceil(extent / spacing); row++) {
      for (const [a, b] of profile.panelSegments(axis, row * spacing)) {
        const divisions = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .25));
        const points = Array.from({ length: divisions + 1 }, (_, i) => {
          const x = THREE.MathUtils.lerp(a[0], b[0], i / divisions), z = THREE.MathUtils.lerp(a[1], b[1], i / divisions);
          return v3(...profile.surfacePoint(x, z, .015));
        });
        for (let i = 0; i < points.length - 1; i++) cablePositions.push(...points[i], ...points[i + 1]);
        // Paired chords and a slender zigzag web give the long-span roof
        // real depth when seen through an open end or from a low angle.
        if (axis === 1 && row % 3 === 0) {
          for (let i = 0; i < points.length - 1; i++) {
            const upperA = points[i].clone().add(v3(0, -.055, 0));
            const upperB = points[i + 1].clone().add(v3(0, -.055, 0));
            const lowerA = points[i].clone().add(v3(0, -.17, 0));
            const lowerB = points[i + 1].clone().add(v3(0, -.17, 0));
            beam(upperA, upperB, .011, steel); beam(lowerA, lowerB, .011, steel);
            beam(i % 2 ? lowerA : upperA, i % 2 ? upperB : lowerB, .006, steel);
          }
        }
      }
    }
  }
  const cableGeometry = new THREE.BufferGeometry();
  cableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cablePositions, 3));
  const cableMesh = new THREE.LineSegments(cableGeometry, cables);
  cableMesh.name = 'Batched ETFE panel cables'; activeGroup.add(cableMesh);
  line(Array.from({ length: 257 }, (_, i) => {
    return v3(...offsetRoofPoint(profile.filmPoint(i / 256), .016));
  }), rimLine);

  // Separated, smooth columns hold the perimeter beam. Their positions
  // and heights come from the canopy itself; there are no arbitrary short piers.
  const pierGeometry = new THREE.CylinderGeometry(.19 * settings.supportThickness, .155 * settings.supportThickness, 1, 28);
  const sides = settings.sideColumns === 4 ? [.13, .2, .265, .325]
    : Array.from({ length: settings.sideColumns }, (_, i) => .13 + .195 * i / (settings.sideColumns - 1));
  const fronts = Array.from({ length: settings.frontColumns }, (_, i) => .44 + .12 * i / (settings.frontColumns - 1));
  const supportStations = [...sides, ...fronts, ...sides.map(u => 1 - u).reverse()];
  const ringPoints = Array.from({ length: 240 }, (_, i) => {
    return v3(...roofPoint(i / 240, settings.supportInset, -.16));
  });
  const ring = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPoints, true), 240, .038, 8, true), steel);
  ring.name = 'Continuous perimeter compression beam';
  const soffitGlow = new THREE.LineBasicMaterial({ color: '#f7d4a3', transparent: true, opacity: .06, toneMapped: false });
  const soffit = line(ringPoints.map(point => point.clone().add(v3(0, -.045, 0))), soffitGlow, true);
  soffit.name = 'Warm perimeter soffit lighting';
  // The outer roof has a visible soffit and a shallow perimeter truss instead
  // of a razor-thin edge balanced on disconnected cylinders.
  const webStations = 168;
  for (let i = 0; i < webStations; i++) {
    const a = v3(...roofPoint(i / webStations, settings.supportInset, -.16));
    const b = v3(...roofPoint((i + 1) / webStations, settings.supportInset, -.16));
    if (Math.min(a.y, b.y) < .48) continue;
    const lowerA = a.clone().add(v3(0, -.16, 0)), lowerB = b.clone().add(v3(0, -.16, 0));
    beam(lowerA, lowerB, .024, steel);
    beam(i % 2 ? lowerA : a, i % 2 ? b : lowerB, .013, steel);
    if (i % 2 === 0) beam(a, lowerA, .013, steel);
  }
  const baseCollar = new THREE.CylinderGeometry(.185 * settings.supportThickness, .205 * settings.supportThickness, .08, 28);
  const capital = new THREE.CylinderGeometry(.235 * settings.supportThickness, .18 * settings.supportThickness, .13, 28);
  for (const u of supportStations) {
    const [x, top, z] = roofPoint(u, settings.supportInset, -.16), bottom = .05;
    instance(pierGeometry, pierMaterial, [x, (bottom + top) / 2, z], [1, top - bottom, 1]);
    instance(baseCollar, concrete, [x, .06, z], [1, 1, 1]);
    instance(capital, steel, [x, top - .07, z], [1, 1, 1]);
    instance(unitBall, coolLight, [x, .073, z + .19], [.045, .017, .022]);
    const lightPosition = roofPoint(u, .62, -.19);
    instance(unitBox, warmLight, lightPosition, [.2, .015, .045], [0, u * TAU, 0]);
    const inward = roofPoint(u, .34, -.23);
    if (top > .7) beam(v3(x, top - .45, z), v3(...inward), .026, steel);
    // Roof ribs connect each column to the translucent span, tucked under it.
    for (let i = 0; i < 10; i++) {
      const ends = [i / 10, (i + 1) / 10].map(t => {
        return v3(...roofPoint(u, t * settings.supportInset, -.15));
      });
      beam(ends[0], ends[1], .035, steel);
    }
  }
  // Suspension cables end at the actual, edited roof height. Their bottom
  // anchors belong to the unscaled stadium interior.
  activeGroup = model;
  for (let i = 0; i < 12; i++) {
    const angle = (i + .5) / 12 * TAU;
    const x = 1.74 * Math.sin(angle), z = -2.2 + 2.9 * Math.cos(angle);
    const roof = profile.surfacePoint(x / settings.roofWidth, z, -.18);
    beam(v3(x, boardTop, z), v3(roof[0] * settings.roofWidth, roof[1] * settings.roofHeight, roof[2]), .008, steel);
  }
  activeGroup = architecture;
  // The eased ends land on shallow foundations rather than exposed blocks.
  for (const u of [0, .375, .625]) {
    const outside = profile.deform(profile.edge(u)), inside = offsetRoofPoint(profile.edge(u), -settings.rimThickness);
    const top = Math.min(outside[1], inside[1]);
    instance(unitBox, concrete, [(outside[0] + inside[0]) / 2, top / 2, (outside[2] + inside[2]) / 2], [.3, top, .35]);
  }

  function wordmarkTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#286477';
    context.font = '600 174px Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText('SoFi', 22, 132);
    context.fillText('Stadium', 625, 132);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (row === 1 && col === 1) continue;
        context.beginPath(); context.arc(464 + col * 48, 78 + row * 48, 16, 0, TAU); context.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const wordmark = wordmarkTexture();
  function roofWordmark(x, z, width, followsSweep = false, rotation = 0) {
    const geometry = new THREE.PlaneGeometry(width, width / 6, 24, 4);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(rotation);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let px = positions.getX(i) + x, pz = positions.getZ(i) + z;
      if (followsSweep) [px, pz] = sweep(px, pz);
      positions.setXYZ(i, ...profile.surfacePoint(px, pz, .045));
    }
    geometry.computeVertexNormals();
    const sign = mesh(geometry, new THREE.MeshBasicMaterial({ map: wordmark, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    sign.castShadow = false; sign.renderOrder = 3;
  }
  roofWordmark(0, -8.02, 2.1, false, Math.PI);
  roofWordmark(0, 4.6, 2.7, true);

  // The theater sits underneath the tail, separated from the seating bowl by
  // the covered outdoor plaza rather than another stadium wall.
  const theaterOutline = outline([[-2.15,5.05],[2.15,5.05],[2.25,6.1],
    [1.15,8.25],[0,9.1],[-1.15,8.25],[-2.25,6.1]].map(([x,z]) => [x, tailZ(z)]));
  const theaterHeight = z => 1.15 - (4.3 + (z - 4.3) / settings.tailLength - 5) * .21;
  const theaterWall = mesh(surface((u, t) => {
    const p = theaterOutline.getPoint(u);
    const [x, z] = sweep(p.x, p.z);
    return [x, THREE.MathUtils.lerp(.045, theaterHeight(p.z), t), z];
  }, 96, 1), material('#bbbeb8', { roughness: .8, side: THREE.DoubleSide }));
  theaterWall.name = 'YouTube Theater enclosure';
  const theaterCap = new THREE.ShapeGeometry(shape(theaterOutline), 48);
  theaterCap.rotateX(-Math.PI / 2);
  const capPositions = theaterCap.attributes.position;
  for (let i = 0; i < capPositions.count; i++) {
    const localZ = capPositions.getZ(i), [x, z] = sweep(capPositions.getX(i), localZ);
    capPositions.setXYZ(i, x, theaterHeight(localZ), z);
  }
  theaterCap.computeVertexNormals();
  mesh(theaterCap, concrete);
  // Slender vertical fins, inset glazing and continuous warm soffit lighting
  // give the low theater a convincing facade beneath the curved tail.
  for (let i = 0; i < 150; i++) {
    const u = i / 150, p = theaterOutline.getPoint(u);
    if (p.z < tailZ(5.17)) continue;
    const next = theaterOutline.getPoint((u + .0001) % 1);
    const [x, z] = sweep(p.x, p.z), [nx, nz] = sweep(next.x, next.z);
    const y = Math.max(.07, theaterHeight(p.z));
    const yaw = -Math.atan2(nz - z, nx - x);
    instance(unitBox, chalk, [x, y / 2, z], [.025, y - .035, .072], [0, yaw, 0]);
    if (i % 5 === 0) instance(unitBox, warmLight, [x, y - .025, z], [.1, .012, .055], [0, yaw, 0]);
  }
  const frontZ = tailZ(4.94), front = sweep(0, frontZ);
  instance(unitBox, darkGlass, [front[0], .51, front[1]], [3.45, .53, .04], [0, tailYaw(frontZ), 0]);
  for (let i = 0; i < 8; i++) {
    const localZ = tailZ(4.91), [x, z] = sweep(-1.7 + i * .485, localZ);
    instance(unitBox, steel, [x, .51, z], [.018, .53, .025], [0, tailYaw(localZ), 0]);
  }
  for (let side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const localZ = tailZ(3.9 + i * .2), [x, z] = sweep(side * 2.85, localZ);
      instance(unitBox, chalk, [x, .035 + i * .027, z], [.95, .06, .22], [0, tailYaw(localZ), 0]);
    }
    for (const edge of [-.4, .4]) {
      const startZ = tailZ(3.88), endZ = tailZ(4.75);
      const a = sweep(side * 2.85 + edge, startZ), b = sweep(side * 2.85 + edge, endZ);
      beam(v3(a[0], .24, a[1]), v3(b[0], .36, b[1]), .012, steel);
      for (const t of [0, .5, 1]) {
        const x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
        beam(v3(x, .05 + .12 * t, z), v3(x, .24 + .12 * t, z), .01, steel);
      }
    }
  }

  for (const { geometry, mat, parent, matrices } of batches.values()) {
    const items = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, i) => items.setMatrixAt(i, matrix));
    items.castShadow = true; items.receiveShadow = true;
    parent.add(items);
  }
  const nightLighting = createStadiumLighting(THREE, { profile, settings, theaterOutline, theaterHeight,
    supports: supportStations.map(u => roofPoint(u, settings.supportInset, -.16)) });
  model.add(nightLighting);
  model.rotation.y = 1.5;
  return { model, framingSurfaces: [floor, roof, glass, tail, fascia], blueLight, ribbon, warmLight, coolLight, soffitGlow, glassRoof, pierMaterial,
    silver, fascia: fascia.material, cables, seams, filmTexture, nightLighting, hospitalityGlass, wordmark, wordmarkNight: false };
}

function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const mat of [].concat(object.material)) materials.add(mat);
  });
  materials.forEach(mat => { for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); mat.dispose(); });
  geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose());
}

export async function mountStadium(figure, showFallback, options = {}) {
  let settings = normalizeSettings(options.settings || DEFAULT_SETTINGS);
  const viewport = figure.querySelector('.stadium-viewport');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The architecture never moves, so shadows need updating only on theme changes.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Interactive SoFi Stadium with branching blue and gold lightning');
  canvas.setAttribute('aria-describedby', 'stadium-keyboard-help');
  canvas.setAttribute('role', 'group');
  canvas.tabIndex = 0;
  viewport.append(canvas);

  const scene = new THREE.Scene();
  let environment = createStadiumEnvironment(THREE, renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .7;
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 150);
  // Balance the widened, offset sail in the frame, including its low point.
  const target = v3(1.65, .4, -.5);
  const initialPosition = options.presentation === 'homepage'
    ? v3(...homeCameraPosition) : v3(19.5, 19, 28);
  camera.position.copy(initialPosition);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = !reducedMotion.matches;
  controls.dampingFactor = .085;
  controls.enablePan = false;
  // Page scrolling is never captured by the scene; the buttons provide zoom.
  controls.enableZoom = false;
  controls.minDistance = 32;
  controls.maxDistance = 65;
  controls.minPolarAngle = .22;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.rotateSpeed = .55;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.update();
  canvas.style.touchAction = 'pan-y';

  const ambient = new THREE.HemisphereLight('#e3f3ff', '#a5a083', 2.7);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff0d8', 3.4);
  sun.position.set(-9, 19, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 55 });
  sun.shadow.normalBias = .018;
  sun.shadow.bias = -.00015;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#adcfe8', 1.2);
  rim.position.set(6, 9, -8); scene.add(rim);

  let modelData;
  try { modelData = buildStadium(settings); } catch (error) { environment.dispose(); renderer.dispose(); canvas.remove(); throw error; }
  let { model, blueLight, glassRoof, pierMaterial } = modelData;
  scene.add(model);
  const lightning = createLightning(THREE);
  scene.add(lightning.mesh);
  let frame = 0, visible = true, lost = false, disposed = false, lastFrame = 0, simulationTime = 0;
  let pendingFrames = 2, particlesPaused = false;
  let motionPreference = reducedMotion.matches;
  const animateParticles = () => !reducedMotion.matches && !particlesPaused && lightning.mesh.visible && settings.lightningSpeed > 0;
  const status = figure.querySelector('[data-scene-status]');
  function syncParticleButton() {
    const button = figure.querySelector('[data-scene-action="particles"]');
    if (!button) return;
    const paused = !animateParticles();
    const label = reducedMotion.matches ? 'Lightning is still: reduced motion enabled'
      : !lightning.mesh.visible || settings.lightningSpeed === 0 ? 'Lightning is still: adjust it in the editor'
      : particlesPaused ? 'Resume lightning' : 'Pause lightning';
    button.setAttribute('aria-label', label); button.title = label;
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? '▷' : 'Ⅱ';
    button.disabled = lost || reducedMotion.matches || !lightning.mesh.visible || settings.lightningSpeed === 0;
  }

  function requestRender(frames = 2) {
    pendingFrames = Math.max(pendingFrames, frames);
    if (!frame && visible && !document.hidden && !lost && !disposed) frame = requestAnimationFrame(render);
  }
  function render(now) {
    frame = 0;
    if (!visible || document.hidden || lost || disposed) { lastFrame = 0; return; }
    // Keep controls in sync even if a media-change event is delayed until
    // after the current frame (for example when resuming a background tab).
    if (motionPreference !== reducedMotion.matches) motionChange();
    // Cap idle lightning rendering at 30fps; active camera motion stays responsive.
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 1 / 60;
    if (pendingFrames > 0 || now - lastFrame >= 32) {
      lastFrame = now;
      if (animateParticles()) simulationTime += dt * settings.lightningSpeed;
      lightning.uniforms.uTime.value = simulationTime;
      controls.update();
      renderer.render(scene, camera);
      pendingFrames = Math.max(0, pendingFrames - 1);
    }
    if (animateParticles() || pendingFrames > 0) requestRender(0);
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Preserve a minimum horizontal field of view continuously, including
    // near-square mobile canvases and the exported poster.
    camera.fov = framingFov(camera.aspect);
    camera.updateProjectionMatrix();
    if (options.presentation === 'homepage') {
      frameStadiumCamera(THREE, camera, modelData.framingSurfaces, width, height);
    }
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    lastFrame = 0;
    if (visible) requestRender();
  });
  visibilityObserver.observe(viewport);
  function onVisibility() { lastFrame = 0; if (!document.hidden) requestRender(); }
  document.addEventListener('visibilitychange', onVisibility);

  function applyTheme(nightOverride) {
    const night = typeof nightOverride === 'boolean' ? nightOverride : document.documentElement.dataset.theme !== 'light';
    ambient.intensity = night ? .28 : .9;
    scene.environmentIntensity = night ? .18 : .5;
    sun.intensity = night ? .3 : 2.6;
    sun.color.set(night ? '#a3c0ed' : '#fff0d8');
    rim.intensity = night ? .9 : .8;
    rim.color.set(night ? '#6298f4' : '#adcfe8');
    blueLight.emissiveIntensity = night ? 2.6 : .38;
    modelData.ribbon.emissiveIntensity = night ? 3 : .3;
    modelData.warmLight.emissiveIntensity = night ? 2.8 : .35;
    modelData.coolLight.emissiveIntensity = night ? 2.1 : .2;
    modelData.soffitGlow.opacity = night ? .9 : .06;
    glassRoof.opacity = settings.glassOpacity * (night ? .74 : 1);
    pierMaterial.emissiveIntensity = night ? .12 : 0;
    modelData.hospitalityGlass.emissive.set('#ffb95f');
    modelData.hospitalityGlass.emissiveIntensity = night ? .3 : 0;
    modelData.nightLighting.visible = night;
    if (modelData.wordmarkNight !== night) {
      const canvas = modelData.wordmark.image, context = canvas.getContext('2d');
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = night ? '#cceeff' : '#286477';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
      modelData.wordmark.needsUpdate = true; modelData.wordmarkNight = night;
    }
    lightning.uniforms.uNight.value = Number(night);
    renderer.toneMappingExposure = (night ? 1.02 : 1.1) * settings.exposure;
    sun.shadow.intensity = settings.shadowStrength;
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }
  document.addEventListener('themechange', applyTheme);
  function applyMaterials() {
    modelData.silver.color.set(settings.roofColor);
    modelData.silver.roughness = settings.roofRoughness;
    modelData.silver.metalness = settings.roofMetalness;
    modelData.fascia.color.set(settings.roofColor).multiplyScalar(.87);
    glassRoof.color.set(settings.glassColor);
    pierMaterial.color.set(settings.columnColor);
    lightning.update(settings);
    syncParticleButton();
    modelData.cables.opacity = settings.gridOpacity;
    modelData.seams.opacity = settings.seamOpacity;
    modelData.filmTexture.repeat.set(18 * settings.fritDensity, 22 * settings.fritDensity);
    applyTheme();
  }
  function updateSettings(next) {
    if (disposed || lost) throw new Error('The 3D preview is unavailable. Wait for recovery or reload.');
    const normalized = normalizeSettings(next);
    if (GEOMETRY_KEYS.some(key => normalized[key] !== settings[key])) {
      const replacement = buildStadium(normalized);
      scene.remove(model); disposeModel(model);
      modelData = replacement;
      ({ model, blueLight, glassRoof, pierMaterial } = modelData);
      scene.add(model);
    }
    settings = normalized;
    applyMaterials();
    return { ...settings };
  }
  controls.addEventListener('change', () => requestRender(reducedMotion.matches ? 1 : 12));
  function motionChange() {
    motionPreference = reducedMotion.matches;
    controls.enableDamping = !motionPreference; lastFrame = 0;
    syncParticleButton(); requestRender();
  }
  reducedMotion.addEventListener('change', motionChange);

  function orbit(theta, phi = 0) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += theta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update(); requestRender();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update(); requestRender();
  }
  function reset() {
    // Clear residual damping before restoring the saved composition.
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    camera.position.copy(initialPosition); controls.target.copy(target); controls.update();
    controls.enableDamping = damping;
    if (options.presentation === 'homepage') resize();
    requestRender();
  }
  function setView(view) {
    reset();
    if (view === 'home') return;
    const angles = { front: [-1.8, 1.12], side: [0, 1.25], top: [0, .24] };
    if (!angles[view]) return;
    const spherical = new THREE.Spherical().setFromVector3(initialPosition.clone().sub(target));
    spherical.theta += angles[view][0]; spherical.phi = angles[view][1];
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update(); requestRender();
  }
  function capturePoster({ night = false } = {}) {
    if (lost || disposed) throw new Error('The 3D preview is unavailable.');
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
    const posterCamera = new THREE.PerspectiveCamera(framingFov(960 / 880), 960 / 880, .1, 150);
    posterCamera.position.set(...homeCameraPosition); posterCamera.lookAt(target);
    frameStadiumCamera(THREE, posterCamera, modelData.framingSurfaces, 960, 880);
    const effectTime = lightning.uniforms.uTime.value;
    try {
      renderer.setPixelRatio(1); renderer.setSize(960, 880, false);
      lightning.uniforms.uTime.value = 0;
      applyTheme(night); renderer.render(scene, posterCamera);
      return canvas.toDataURL('image/png');
    } finally {
      lightning.uniforms.uTime.value = effectTime;
      renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
      applyTheme(); renderer.render(scene, camera); requestRender();
    }
  }
  function toggleParticles() {
    if (reducedMotion.matches || lost || disposed) return;
    particlesPaused = !particlesPaused; lastFrame = 0; syncParticleButton(); requestRender();
  }
  canvas.addEventListener('keydown', event => {
    const actions = {
      ArrowLeft: () => orbit(-.12), ArrowRight: () => orbit(.12),
      ArrowUp: () => orbit(0, -.08), ArrowDown: () => orbit(0, .08),
      '+': () => zoom(.9), '=': () => zoom(.9), '-': () => zoom(1.1),
      Home: reset, p: toggleParticles, P: toggleParticles,
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  figure.querySelectorAll('[data-scene-action]').forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      if (button.dataset.sceneAction === 'reset') reset();
      else if (button.dataset.sceneAction === 'particles') {
        toggleParticles();
      }
      else zoom(button.dataset.sceneAction === 'zoom-in' ? .88 : 1.14);
    });
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; showFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    // A render target loses its pixels with the context. Recreate the filtered
    // sky rather than leaving the metal reflecting an empty GPU texture.
    environment.dispose(); environment = createStadiumEnvironment(THREE, renderer);
    scene.environment = environment.texture;
    lost = false; renderer.shadowMap.needsUpdate = true;
    figure.querySelectorAll('[data-scene-action]').forEach(button => { button.disabled = false; });
    syncParticleButton();
    figure.querySelector('.stadium-hint').textContent = 'Drag to explore · a little Bolt Up energy';
    figure.dataset.ready = 'true'; status.textContent = 'Interactive stadium ready.'; requestRender();
  });
  function dispose(event = {}) {
    if (event.persisted || disposed) return;
    disposed = true; cancelAnimationFrame(frame);
    resizeObserver.disconnect(); visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('themechange', applyTheme);
    reducedMotion.removeEventListener('change', motionChange);
    controls.dispose();
    disposeModel(model);
    lightning.dispose();
    environment.dispose();
    window.removeEventListener('pagehide', dispose);
    renderer.dispose();
  }
  window.addEventListener('pagehide', dispose);
  resize(); applyMaterials();
  renderer.render(scene, camera);
  figure.dataset.ready = 'true';
  status.textContent = 'Interactive stadium ready.';
  if (document.activeElement === figure) canvas.focus({ preventScroll: true });
  return { updateSettings, getSettings: () => ({ ...settings }), setView, capturePoster, dispose };
}

// Steady architectural lighting. No animation loop, bloom pass, or shadow maps.
import { bowlPoint, ENTRY_PORTAL } from './stadium-interior.js';

export function createStadiumLighting(THREE, { profile, settings, supports, theaterOutline, theaterHeight }) {
  const lighting = new THREE.Group();
  lighting.name = 'Night game architectural lighting';
  lighting.visible = false;
  const canopy = new THREE.Group();
  canopy.scale.set(settings.roofWidth, settings.roofHeight, 1);
  lighting.add(canopy);
  const point = values => new THREE.Vector3(...values);
  const blue = new THREE.MeshBasicMaterial({ color: '#a6eaff', toneMapped: false });
  const gold = new THREE.MeshBasicMaterial({ color: '#ffdaa0', toneMapped: false });

  // The halo is confined to the receiving surface. Its smooth alpha falloff
  // stays soft at phone sizes without blurring the rest of the miniature.
  function glow(color, opacity, radial = false) {
    return new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 p = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * p;
        }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
        void main() {
          float distance = ${radial ? 'length(vUv * 2.0 - 1.0)' : 'abs(vUv.y * 2.0 - 1.0)'};
          float falloff = 1.0 - smoothstep(0.0, 1.0, distance);
          gl_FragColor = vec4(color, opacity * falloff * falloff);
          #include <colorspace_fragment>
        }`,
    });
  }
  const blueHalo = glow('#168bff', .58);
  const warmHalo = glow('#ffaf52', .42);
  function strip(parent, name, sample, material, segments = 240, rows = 8) {
    const positions = [], uv = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        positions.push(...sample(i / segments, v)); uv.push(i / segments, v);
        if (i < segments && j < rows) {
          const a = i * (rows + 1) + j, b = a + rows + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; parent.add(mesh);
    return mesh;
  }
  function tube(parent, name, sample, material, radius, closed = true, segments = 240) {
    const points = Array.from({ length: segments + (closed ? 0 : 1) }, (_, i) => point(sample(i / segments)));
    const path = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, segments, radius, 5, closed), material);
    mesh.name = name; parent.add(mesh);
  }
  const onRoof = (p, offset) => profile.surfacePoint(p[0], p[2], offset);
  // Resolve the S return in both directions so triangle interiors clear the
  // curved sheet; matching endpoints alone still lets a coarse halo clip it.
  tube(canopy, 'Continuous cyan fascia light', u => onRoof(profile.edge(u), -settings.rimThickness * .36), blue, .012, true, 720);
  strip(canopy, 'Blue light scattered over the roof edge', (u, v) =>
    onRoof(profile.radialPoint(u, .95 + v * .05), .025), blueHalo, 960, 12);
  tube(canopy, 'Illuminated oval roof frame', u => onRoof(profile.ovalPoint(u, .045), .058), blue, .009);
  strip(canopy, 'Soft oval roof glow', (u, v) => onRoof(profile.ovalPoint(u, -.12 + v * .33), .06), blueHalo);

  // The theater's amber soffit follows the same swept outline as its fins.
  const theaterPoint = (u, drop = 0) => {
    const p = theaterOutline.getPoint(u), [x, z] = profile.sweep(p.x, p.z);
    return [x, Math.max(.05, theaterHeight(p.z) - .016 - drop), z];
  };
  tube(canopy, 'Amber theater soffit', u => theaterPoint(u), gold, .011, true, 160);
  strip(canopy, 'Warm theater facade wash', (u, v) => theaterPoint(u, v * .27), warmHalo, 160);

  // Hospitality levels belong to the unscaled bowl, not the editable canopy.
  for (const [side, [start, end]] of [[.28, 2.86], [3.42, 6]].entries()) {
    for (const y of [1.04, 1.58]) {
      const at = (u, v = 0) => {
        const [x, z] = bowlPoint(start + (end - start) * u, 1.135);
        return [x, y + v, z];
      };
      tube(lighting, `Warm concourse ${side} at ${y}`, u => at(u), gold, .009, false, 64);
      strip(lighting, `Concourse light spill ${side} at ${y}`, (u, v) => at(u, (v - .5) * .18), warmHalo, 64);
    }
  }
  tube(lighting, 'Warm light above the entrance doors', u => {
    const [x, z] = bowlPoint(ENTRY_PORTAL.start + (ENTRY_PORTAL.end - ENTRY_PORTAL.start) * u, 1.152);
    return [x, ENTRY_PORTAL.height - .035, z];
  }, gold, .008, false, 64);

  const poolMaterial = glow('#319aff', .32, true);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMaterial, supports.length);
  const dummy = new THREE.Object3D();
  supports.forEach(([x, , z], i) => {
    dummy.position.set(x * settings.roofWidth, -.005, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(.95, .95, 1); dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
  });
  pools.name = 'Soft blue pools at column footings'; lighting.add(pools);

  // Four broad, unshadowed lights illuminate real surfaces. They rotate with
  // the building, so field and plaza lighting cannot drift as the view changes.
  function lamp(name, color, intensity, distance, position) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.name = name; light.position.set(...position); lighting.add(light);
  }
  lamp('White bowl floodlights', '#e9f5ff', 28, 12, [0, 2.05, -2.2]);
  for (const side of [-1, 1]) {
    lamp('Blue facade uplighting', '#2587ff', 14, 11, [side * 4.55, .48, -2.1]);
  }
  const plaza = profile.sweep(0, profile.tailZ(4.9));
  lamp('Warm theater entrance lighting', '#ffb55e', 13, 7, [plaza[0] * settings.roofWidth, .8, plaza[1]]);
  return lighting;
}

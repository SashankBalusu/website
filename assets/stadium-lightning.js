// A single batch of thin, branching electrical discharges. Geometry is built
// once; the shader reveals and fades each burst without spawning particles.
export const MAX_BURSTS = 12;
export const BURST_DURATION = .38;
export const burstSpacing = amount => 2.1 - Math.max(0, Math.min(1, amount)) * 1.2;

export function lightningLayout() {
  let seed = 7142;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const add = (a, b) => a.map((value, axis) => value + b[axis]);
  const scale = (a, factor) => a.map(value => value * factor);
  function trace(start, end, steps, roughness) {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps, envelope = Math.sin(Math.PI * t);
      return start.map((value, axis) => value + (end[axis] - value) * t
        + (random() - .5) * roughness * envelope);
    });
  }
  return Array.from({ length: MAX_BURSTS }, (_, arc) => {
    // Alternate around the stadium instead of chasing around a visible ring.
    const angle = .55 + ((arc * 5) % MAX_BURSTS) * Math.PI * 2 / MAX_BURSTS + random() * .2;
    const outward = [Math.sin(angle), 0, Math.cos(angle)];
    const tangent = [Math.cos(angle), 0, -Math.sin(angle)];
    const start = [outward[0] * 6.8, 1.6 + random() * 1.7, outward[2] * 10.5];
    const direction = add(scale(tangent, 2.3 + random()), scale(outward, .8));
    direction[1] = .9 + random();
    const main = trace(start, add(start, direction), 16, .5), strokes = [];
    function append(points, strength, gold, progressStart = 0, progressLength = 1) {
      for (let i = 1; i < points.length; i++) strokes.push({
        start: points[i - 1], end: points[i],
        strength: strength * (1 - .35 * i / points.length), gold,
        progress: progressStart + progressLength * i / (points.length - 1),
      });
    }
    append(main, 1, 0);
    for (const [branch, joint] of [5, 9, 12].entries()) {
      const turn = branch % 2 ? -1 : 1;
      const delta = add(scale(outward, turn * (.7 + random() * .7)), scale(tangent, .3 + random() * .5));
      delta[1] = .3 + random() * .9;
      append(trace(main[joint], add(main[joint], delta), 5, .28),
        .62, branch === 2 ? 1 : 0, joint / 16, .25);
    }
    // Lengthen the whole discharge around its midpoint, preserving the forks
    // and framing instead of pushing every endpoint farther offscreen.
    // Ribbon thickness and the animation envelope are intentionally unchanged.
    const center = add(start, scale(direction, .5));
    const extend = point => point.map((value, axis) => center[axis] + (value - center[axis]) * 1.6);
    return strokes.map(stroke => ({ ...stroke, start: extend(stroke.start), end: extend(stroke.end) }));
  });
}

export function createLightning(THREE) {
  const position = [], starts = [], ends = [], timing = [];
  for (const [arc, strokes] of lightningLayout().entries()) {
    for (const stroke of strokes) {
      for (const [along, side] of [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]]) {
        position.push(along, side, 0);
        starts.push(...stroke.start); ends.push(...stroke.end);
        timing.push(arc, stroke.strength, stroke.gold, stroke.progress);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 3));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 3));
  geometry.setAttribute('aTiming', new THREE.Float32BufferAttribute(timing, 4));
  const uniforms = {
    uTime: { value: 0 }, uNight: { value: 0 }, uGlow: { value: .5 },
    uSpacing: { value: burstSpacing(.6) },
    uBlue: { value: new THREE.Color('#0080c6') }, uGold: { value: new THREE.Color('#ffc820') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute vec3 aStart; attribute vec3 aEnd; attribute vec4 aTiming;
      uniform float uTime; uniform float uSpacing; uniform float uGlow;
      varying float vAcross; varying float vAlpha; varying float vGold;
      void main() {
        // One short discharge at a time, separated by generous quiet gaps.
        // The initial phase is visible for posters and reduced-motion views.
        float age = mod(uTime + uSpacing * ${MAX_BURSTS.toFixed(1)}
          - aTiming.x * uSpacing + .13, uSpacing * ${MAX_BURSTS.toFixed(1)});
        float envelope = smoothstep(0.0, .035, age)
          * (1.0 - smoothstep(.07, ${BURST_DURATION.toFixed(2)}, age));
        float reveal = smoothstep(0.0, .075, age) * 1.1;
        vAlpha = envelope * (1.0 - smoothstep(reveal - .08, reveal, aTiming.w));
        vGold = aTiming.z; vAcross = position.y;
        vec4 a = modelViewMatrix * vec4(aStart, 1.0);
        vec4 b = modelViewMatrix * vec4(aEnd, 1.0);
        vec2 delta = b.xy - a.xy;
        vec2 normal = vec2(-delta.y, delta.x) / max(length(delta), .001);
        vec4 view = mix(a, b, position.x);
        view.xy += normal * position.y * (.1 + uGlow * .1) * aTiming.y;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 uBlue; uniform vec3 uGold; uniform float uNight; uniform float uGlow;
      varying float vAcross; varying float vAlpha; varying float vGold;
      void main() {
        float d = abs(vAcross);
        // Integrate the narrow core over the pixel footprint so distant arcs
        // stay continuous instead of breaking into bright subpixel speckles.
        float pixel = fwidth(vAcross);
        float variance = 1.0 / 65.0 + pixel * pixel * .12;
        float core = exp(-d * d / variance) * inversesqrt(variance * 65.0);
        float halo = exp(-d * d * 4.0) * mix(.23, .34, uNight);
        float alpha = (core + halo) * vAlpha * uGlow * 1.65;
        if (alpha < .004) discard;
        vec3 tint = mix(uBlue, uGold, vGold);
        vec3 color = mix(tint, vec3(.92, .98, 1.0), core * mix(.4, .8, uNight));
        gl_FragColor = vec4(color, min(alpha, .86));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Branching lightning bursts';
  mesh.frustumCulled = false; // Ribbon positions are expanded in the vertex shader.
  mesh.rotation.y = 1.5;
  return { mesh, uniforms, update(settings) {
    mesh.visible = settings.lightningAmount > 0 && settings.lightningGlow > 0;
    uniforms.uSpacing.value = burstSpacing(settings.lightningAmount);
    uniforms.uGlow.value = settings.lightningGlow;
    uniforms.uBlue.value.set(settings.lightningColor);
    uniforms.uGold.value.set(settings.lightningAccent);
  }, dispose() { geometry.dispose(); material.dispose(); } };
}

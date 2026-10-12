import * as THREE from './vendor/three/three.module.min.js';

// Both the copper surface and its halo use the same distance along the wires.
const chargeShader = `
  uniform vec3 uChargeHeads;
  uniform float uChargeStill;
  varying vec2 vWire;

  vec2 chargeAt(float head) {
    float lane = floor(vWire.x * 9.0 + 0.5);
    float behind = head - vWire.y - sin(lane * 2.39996) * 0.025;
    float strand = pow(0.5 + 0.5 * cos(vWire.x * 56.5486678), 7.0);
    float tipDistance = behind / 0.055;
    float tip = exp(-tipDistance * tipDistance);
    float trail = smoothstep(0.0, 0.025, behind) * exp(-max(behind, 0.0) / 0.14);
    return vec2(tip * (0.3 + strand * 0.7), trail * strand);
  }

  vec2 wireCharge() {
    vec2 charge = chargeAt(uChargeHeads.x) + chargeAt(uChargeHeads.y) + chargeAt(uChargeHeads.z);
    charge += vec2(uChargeStill * 0.22, uChargeStill * 0.45);
    return min(charge, vec2(1.25));
  }
`;

const screenVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const blurShader = `
  uniform sampler2D uTexture;
  uniform vec2 uDirection;
  varying vec2 vUv;
  float blurredCharge() {
    float light = texture2D(uTexture, vUv).r * 0.227027;
    light += texture2D(uTexture, vUv + uDirection * 1.384615).r * 0.316216;
    light += texture2D(uTexture, vUv - uDirection * 1.384615).r * 0.316216;
    light += texture2D(uTexture, vUv + uDirection * 3.230769).r * 0.070270;
    light += texture2D(uTexture, vUv - uDirection * 3.230769).r * 0.070270;
    return light;
  }
`;

export function createRibbonCharge(material, wireLength, { onComplete = () => {} } = {}) {
  if (!Number.isFinite(wireLength) || wireLength <= 0) throw new Error('Ribbon wire distances are unavailable.');
  const uniforms = {
    uChargeHeads: { value: new THREE.Vector3(-100, -100, -100) },
    uChargeStill: { value: 0 },
  };
  const starts = [];
  let stillStart = null, lastTrigger = -Infinity, active = false;
  let source, blurred, maskMaterial, blurMaterial, glowMaterial, screen, quad;
  const screenCamera = new THREE.Camera();
  const duration = 500;

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wireDistance;\nvarying vec2 vWire;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWire = vec2(uv.x, wireDistance);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${chargeShader}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 charge = wireCharge();
        totalEmissiveRadiance += vec3(0.80, 0.93, 1.0) * charge.x * 7.0;
        totalEmissiveRadiance += vec3(0.22, 0.55, 1.0) * charge.y * 3.0;
      `);
  };
  material.customProgramCacheKey = () => 'ribbon-lightning-v1';

  function ensureGlow() {
    if (source) return;
    // Allocate the two small buffers only after the first interaction.
    source = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    blurred = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    maskMaterial = new THREE.ShaderMaterial({
      uniforms, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: `attribute float wireDistance; varying vec2 vWire;
        void main() {
          vWire = vec2(uv.x, wireDistance);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `${chargeShader}
        void main() {
          vec2 charge = wireCharge();
          float light = min(1.0, charge.x + charge.y * 0.35);
          gl_FragColor = vec4(vec3(light), 1.0);
        }`,
    });
    blurMaterial = new THREE.ShaderMaterial({
      uniforms: { uTexture: { value: source.texture }, uDirection: { value: new THREE.Vector2() } },
      vertexShader: screenVertex, fragmentShader: `${blurShader}
        void main() { gl_FragColor = vec4(vec3(blurredCharge()), 1.0); }`,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: blurred.texture }, uDirection: { value: new THREE.Vector2() },
        uGlowStrength: { value: .7 },
      },
      vertexShader: screenVertex, fragmentShader: `${blurShader}
        uniform float uGlowStrength;
        void main() {
          float glow = clamp(blurredCharge() * uGlowStrength * 2.8, 0.0, 0.6);
          gl_FragColor = vec4(0.76, 0.90, 1.0, glow);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    screen = new THREE.Scene();
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
    quad.frustumCulled = false;
    screen.add(quad);
  }

  function trigger(now, reducedMotion) {
    if (now - lastTrigger < 180) return;
    lastTrigger = now;
    if (reducedMotion) stillStart = now;
    else {
      if (starts.length === 3) starts.shift();
      starts.push(now);
    }
    active = true;
  }

  function update(now) {
    while (starts.length && now - starts[0] >= duration) starts.shift();
    uniforms.uChargeHeads.value.set(-100, -100, -100);
    starts.forEach((start, index) => {
      const progress = (now - start) / duration;
      uniforms.uChargeHeads.value.setComponent(index, -.12 + progress * (wireLength + .82));
    });
    const stillProgress = stillStart === null ? 1 : Math.min(1, (now - stillStart) / 700);
    uniforms.uChargeStill.value = stillStart === null || stillProgress === 1 ? 0 : Math.sin(stillProgress * Math.PI) * .65;
    if (stillProgress === 1) stillStart = null;
    const finished = active && starts.length === 0 && stillStart === null;
    active = starts.length > 0 || stillStart !== null;
    if (finished) onComplete();
    return active;
  }

  function stop() {
    starts.length = 0;
    stillStart = null;
    active = false;
    uniforms.uChargeHeads.value.set(-100, -100, -100);
    uniforms.uChargeStill.value = 0;
  }

  function render(renderer, scene, camera) {
    if (!active) { renderer.render(scene, camera); return; }
    ensureGlow();
    const pixelRatio = renderer.getPixelRatio();
    const width = Math.max(1, Math.round(renderer.domElement.width / pixelRatio / 2));
    const height = Math.max(1, Math.round(renderer.domElement.height / pixelRatio / 2));
    if (source.width !== width || source.height !== height) {
      source.setSize(width, height);
      blurred.setSize(width, height);
    }
    blurMaterial.uniforms.uDirection.value.set(1 / width, 0);
    glowMaterial.uniforms.uDirection.value.set(0, 1 / height);
    glowMaterial.uniforms.uGlowStrength.value = document.documentElement.dataset.theme === 'dark' ? 1 : .65;
    const previousMaterial = scene.overrideMaterial;
    const previousAutoClear = renderer.autoClear;
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.autoClear = true;
      scene.overrideMaterial = maskMaterial;
      renderer.setRenderTarget(source);
      renderer.render(scene, camera);
      scene.overrideMaterial = previousMaterial;
      quad.material = blurMaterial;
      renderer.setRenderTarget(blurred);
      renderer.render(screen, screenCamera);
      renderer.setRenderTarget(previousTarget);
      renderer.render(scene, camera);
      renderer.autoClear = false;
      quad.material = glowMaterial;
      renderer.render(screen, screenCamera);
    } finally {
      scene.overrideMaterial = previousMaterial;
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }
  }

  function dispose() {
    stop();
    source?.dispose();
    blurred?.dispose();
    maskMaterial?.dispose();
    blurMaterial?.dispose();
    glowMaterial?.dispose();
    quad?.geometry.dispose();
  }

  return { trigger, update, stop, render, dispose };
}

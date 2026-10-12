import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { createRibbonMonogram, RIBBON_SETTINGS } from './ribbon-geometry.js?v=charge-1';
import { createRibbonCharge } from './ribbon-charge.js?v=theme-pulse-1';

const REST = Object.freeze({ x: -.08, y: -.18, z: .025 });

export function mountRibbon(button, { onChargeComplete } = {}) {
  const events = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const target = { ...REST };
  let renderer, environment, material, monogram, charge, resizeObserver;
  let frame = 0, lastFrame = 0, drag = null, dragged = false, disposed = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, .02, 3.1);
  camera.lookAt(0, .02, 0);

  const canRender = () => !disposed && !document.hidden && button.isConnected;
  const listen = (element, event, callback) => element.addEventListener(event, callback, { signal: events.signal });

  function schedule() {
    if (!frame && renderer && canRender()) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (!canRender()) return;
    const factor = reducedMotion.matches ? 1 : 1 - Math.pow(.82, Math.min((now - lastFrame) / 16.7, 3));
    lastFrame = now;
    let changing = false;
    for (const axis of ['x', 'y', 'z']) {
      monogram.rotation[axis] = THREE.MathUtils.lerp(monogram.rotation[axis], target[axis], factor);
      changing ||= Math.abs(monogram.rotation[axis] - target[axis]) > .00015;
    }
    const charging = charge.update(now);
    charge.render(renderer, scene, camera);
    changing ||= charging;
    if (changing) schedule();
  }

  function resize() {
    const { width, height } = button.getBoundingClientRect();
    if (!renderer || !width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    schedule();
  }

  function appearance() {
    const night = document.documentElement.dataset.theme === 'dark';
    material.roughness = night ? .27 : .3;
    scene.environmentIntensity = night ? 1.15 : 1.05;
    renderer.toneMappingExposure = night ? 1.04 : 1;
    schedule();
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    charge?.stop();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    events.abort();
    resizeObserver?.disconnect();
    monogram?.traverse(object => object.geometry?.dispose());
    charge?.dispose();
    material?.dispose();
    environment?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    delete button.dataset.ready;
  }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    button.append(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, .04);
    room.dispose();
    pmrem.dispose();
    scene.environment = environment.texture;

    const key = new THREE.DirectionalLight('#fff8e9', 2.3);
    key.position.set(-3, 5, 5);
    const fill = new THREE.DirectionalLight('#e7eff3', .9);
    fill.position.set(4, 1, 3);
    scene.add(key, fill, new THREE.HemisphereLight('#f1f5ff', '#58564c', .35));
    material = new THREE.MeshPhysicalMaterial({
      color: RIBBON_SETTINGS.color, metalness: .94, roughness: .3,
      clearcoat: .18, clearcoatRoughness: .32, side: THREE.DoubleSide,
    });
    monogram = createRibbonMonogram(material);
    charge = createRibbonCharge(material, monogram.userData.wireLength, { onComplete: onChargeComplete });
    monogram.rotation.set(REST.x, REST.y, REST.z);
    scene.add(monogram);
    appearance();
    resize();
    renderer.render(scene, camera);
    button.dataset.ready = 'true';

    listen(button, 'pointerdown', event => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, rx: target.x, ry: target.y };
      dragged = false;
      button.setPointerCapture(event.pointerId);
    });
    listen(button, 'pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      dragged ||= Math.abs(dx) + Math.abs(dy) > 5;
      target.y = drag.ry + dx * .014;
      target.x = THREE.MathUtils.clamp(drag.rx + dy * .006, -.6, .6);
      schedule();
    });
    listen(button, 'pointerup', event => {
      drag = null;
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    });
    listen(button, 'pointercancel', () => { drag = null; Object.assign(target, REST); schedule(); });
    listen(button, 'click', event => {
      if (dragged && event.detail !== 0) { dragged = false; return; }
      dragged = false;
      charge.trigger(performance.now(), reducedMotion.matches);
      schedule();
    });
    listen(button, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') Object.assign(target, REST);
      if (event.key === 'ArrowLeft') target.y -= .18;
      if (event.key === 'ArrowRight') target.y += .18;
      if (event.key === 'ArrowUp') target.x = Math.max(-.6, target.x - .08);
      if (event.key === 'ArrowDown') target.x = Math.min(.6, target.x + .08);
      schedule();
    });
    listen(document, 'themechange', appearance);
    listen(reducedMotion, 'change', () => { pause(); schedule(); });
    listen(document, 'visibilitychange', () => document.hidden ? pause() : schedule());
    listen(window, 'pagehide', pause);
    listen(window, 'pageshow', schedule);
    listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); dispose(); });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(button);
  } catch (error) {
    dispose();
    console.warn('Using the still ribbon mark.', error);
  }

  return { dispose };
}

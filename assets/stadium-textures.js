// All artwork is generated locally; no image downloads or external assets.
const TAU = Math.PI * 2;

function canvas2D(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}
function texture(THREE, canvas, repeat = false) {
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  if (repeat) result.wrapS = result.wrapT = THREE.RepeatWrapping;
  return result;
}

function bolt(context, x, y, width) {
  context.save(); context.translate(x, y); context.scale(width / 240, width / 240);
  context.beginPath(); context.moveTo(-119, 24);
  context.bezierCurveTo(-50, -31, 33, -37, 113, -1);
  context.lineTo(86, 0); context.lineTo(121, 29); context.lineTo(72, 14);
  context.lineTo(83, 8); context.bezierCurveTo(14, -11, -58, -1, -119, 24);
  context.closePath(); context.lineJoin = 'round';
  context.strokeStyle = '#ffffff'; context.lineWidth = 8; context.stroke();
  context.strokeStyle = '#0080c6'; context.lineWidth = 4; context.stroke();
  context.fillStyle = '#ffc820'; context.fill(); context.restore();
}

export function createFieldTexture(THREE) {
  const [canvas, ctx] = canvas2D(768, 1728);
  const left = 34, right = 734, top = 26, bottom = 1702;
  const yard = (bottom - top) / 120;
  ctx.fillStyle = '#345c38'; ctx.fillRect(0, 0, 768, 1728);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? '#426f43' : '#477748';
    ctx.fillRect(left, top + i * yard * 5, right - left, yard * 5);
  }
  // Deterministic, subpixel grass grain survives close inspection without
  // becoming a noisy high-contrast pattern at the homepage scale.
  let seed = 83;
  for (let i = 0; i < 40000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % 768;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed % 1728;
    ctx.fillStyle = i % 2 ? '#ffffff08' : '#132e2010'; ctx.fillRect(x, y, 1, 3);
  }
  ctx.fillStyle = '#1678b0';
  for (const y of [top, bottom - 10 * yard]) ctx.fillRect(left, y, right - left, 10 * yard);
  ctx.strokeStyle = '#f4f3dc'; ctx.lineWidth = 4;
  ctx.strokeRect(left, top, right - left, bottom - top);
  for (let i = 10; i <= 110; i += 5) {
    const y = top + i * yard;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let i = 11; i < 110; i++) {
    const y = top + i * yard;
    for (const [a, b] of [[left + 4, left + 16], [323, 335], [433, 445], [right - 16, right - 4]]) {
      ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
    }
  }
  ctx.fillStyle = '#f4f3dc'; ctx.font = 'bold 38px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 20; i <= 100; i += 10) {
    const number = String(Math.min(i - 10, 110 - i)), y = top + i * yard;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side < 0 ? 118 : 650, y); ctx.rotate(side * Math.PI / 2);
      ctx.fillText(number, 0, 0); ctx.restore();
    }
  }
  for (const end of [-1, 1]) {
    ctx.save(); ctx.translate(384, end < 0 ? top + 5 * yard : bottom - 5 * yard);
    if (end > 0) ctx.rotate(Math.PI);
    ctx.font = 'italic 900 77px Arial, sans-serif'; ctx.lineWidth = 2; ctx.strokeStyle = '#ffd24c';
    ctx.strokeText('CHARGERS', 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillText('CHARGERS', 0, 0); ctx.restore();
  }
  bolt(ctx, 384, 865, 355);
  return texture(THREE, canvas);
}

export function createBoardTexture(THREE) {
  const [canvas, ctx] = canvas2D(2048, 192);
  const fill = ctx.createLinearGradient(0, 0, 0, 192);
  fill.addColorStop(0, '#1aa4d7'); fill.addColorStop(.6, '#0076b8'); fill.addColorStop(1, '#084c86');
  ctx.fillStyle = fill; ctx.fillRect(0, 0, 2048, 192);
  ctx.fillStyle = '#ffc820'; ctx.fillRect(0, 174, 2048, 5);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 70px Arial, sans-serif'; ctx.fillText('LOS ANGELES CHARGERS', 690, 94);
  bolt(ctx, 176, 89, 250); bolt(ctx, 1830, 89, 260);
  ctx.font = 'bold 56px Arial, sans-serif'; ctx.fillText('BOLT UP', 1390, 94);
  ctx.fillStyle = '#00000012';
  for (let y = 0; y < 192; y += 4) ctx.fillRect(0, y, 2048, 1);
  return texture(THREE, canvas, true);
}

export function createCladdingTexture(THREE) {
  const [canvas, ctx] = canvas2D(1024, 1024);
  const cell = 128;
  ctx.fillStyle = '#d9dcd8'; ctx.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const x = col * cell, y = row * cell;
    for (let half = 0; half < 2; half++) {
      const value = 223 + ((row * 11 + col * 7 + half * 13) % 8);
      ctx.fillStyle = `rgb(${value},${value + 1},${value - 2})`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y + cell);
      ctx.lineTo(x + (half ? 0 : cell), y + (half ? cell : 0)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#737f7d55'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    // Perforations modulate the light, like the porous aluminum of the real
    // canopy. Their small, quiet pattern is filtered away at distant views.
    for (let dy = 5; dy < cell - 3; dy += 7) for (let dx = 5; dx < cell - 3; dx += 7) {
      const wave = Math.sin((x + dx) * .012 + Math.cos((y + dy) * .009) * 2);
      ctx.fillStyle = '#75828268'; ctx.beginPath();
      ctx.arc(x + dx, y + dy, 1.05 + (wave + 1) * .43, 0, TAU); ctx.fill();
    }
  }
  return texture(THREE, canvas, true);
}

export function createFritTexture(THREE) {
  const [canvas, ctx] = canvas2D(128, 128);
  ctx.fillStyle = '#afc1c4'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#eff2eb';
  for (let row = 0; row <= 16; row++) for (let col = -1; col <= 16; col++) {
    ctx.beginPath(); ctx.arc(col * 8 + (row % 2 ? 4 : 0), row * 8, 3.35, 0, TAU); ctx.fill();
  }
  return texture(THREE, canvas, true);
}

export function createPavingTexture(THREE) {
  const [canvas, ctx] = canvas2D(512, 512);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    const shade = 222 + (row * 7 + col * 13) % 9;
    ctx.fillStyle = `rgb(${shade},${shade},${shade - 3})`;
    ctx.fillRect(col * 128, row * 64, 128, 64);
    ctx.strokeStyle = '#8c928b50'; ctx.lineWidth = 1;
    ctx.strokeRect(col * 128 + .5, row * 64 + .5, 127, 63);
  }
  return texture(THREE, canvas, true);
}

// A tiny HDR sky gives metal and glazing something to reflect. The scene
// remains transparent; this is lighting data, never a visible backdrop.
export function createStadiumEnvironment(THREE, renderer) {
  const width = 256, height = 128, data = new Float32Array(width * height * 4);
  const sky = new THREE.Color('#b4cee3'), horizon = new THREE.Color('#f5f0e4');
  const ground = new THREE.Color('#8e938e'), color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const elevation = Math.cos(y / (height - 1) * Math.PI);
    for (let x = 0; x < width; x++) {
      if (elevation >= 0) color.copy(horizon).lerp(sky, Math.pow(elevation, .45));
      else color.copy(horizon).lerp(ground, Math.pow(-elevation, .25));
      const distance = ((x / width - .72) / .09) ** 2 + ((y / height - .24) / .11) ** 2;
      const sun = Math.exp(-distance * 2) * 2.7;
      const offset = (y * width + x) * 4;
      data[offset] = color.r + sun; data[offset + 1] = color.g + sun * .9;
      data[offset + 2] = color.b + sun * .72; data[offset + 3] = 1;
    }
  }
  const source = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  source.mapping = THREE.EquirectangularReflectionMapping; source.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(source);
  source.dispose(); generator.dispose();
  return environment;
}

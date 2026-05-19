import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import vm from 'vm';
import fg from 'fast-glob';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_DIR = path.resolve(ROOT, process.argv[2] || 'images/originals');
const ASSETS_DIR = path.resolve(ROOT, 'assets');
const META_PATH = path.join(ASSETS_DIR, 'imageMeta.json');
const CONFIG_PATH = path.join(ASSETS_DIR, 'galleryConfig.js');
const TARGET_WIDTHS = [480, 960, 1600];
const SUPPORTED = ['.jpg', '.jpeg', '.png', '.heic', '.tif', '.tiff', '.webp'];
const QUAL = {
  avif: { quality: 45 },
  webp: { quality: 70 },
  jpeg: { quality: 78, progressive: true, mozjpeg: true }
};

function outDirForWidth(width) {
  return path.join(ASSETS_DIR, 'thumbs', `${width}w`);
}

function normalizeName(filename) {
  return filename.replace(/\.(jpeg)$/i, '.jpg');
}

function defaultShape(width, height) {
  const ratio = width / height;
  if (ratio >= 2.1) return { shape: 'panorama', cols: 7, rows: 3 };
  if (ratio >= 1.25) return { shape: 'wide', cols: 5, rows: 3 };
  if (ratio <= 0.78) return { shape: 'portrait', cols: 3, rows: 6 };
  return { shape: 'square', cols: 4, rows: 4 };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback) {
  if (!(await exists(file))) return fallback;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readGalleryConfig() {
  if (!(await exists(CONFIG_PATH))) {
    return { imageOrder: [], cityByImage: {}, cropByImage: {} };
  }

  const source = await fs.readFile(CONFIG_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: CONFIG_PATH });
  return sandbox.window.GALLERY_CONFIG || { imageOrder: [], cityByImage: {}, cropByImage: {} };
}

async function writeGalleryConfig(config) {
  const body = JSON.stringify(config, null, 2);
  await fs.writeFile(CONFIG_PATH, `window.GALLERY_CONFIG = ${body};\n`);
}

async function ensureDirs() {
  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  for (const width of TARGET_WIDTHS) {
    await fs.mkdir(outDirForWidth(width), { recursive: true });
  }
}

async function sourceImages() {
  const entries = await fg(['*'], { cwd: SOURCE_DIR, absolute: true, onlyFiles: true });
  return entries
    .filter(file => SUPPORTED.includes(path.extname(file).toLowerCase()))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
}

async function lqipBuffer(input) {
  return await sharp(input)
    .resize({ width: 24, withoutEnlargement: true })
    .blur()
    .jpeg({ quality: 35 })
    .toBuffer();
}

async function isThumbCurrent(source, outBase) {
  const outputs = [`${outBase}.avif`, `${outBase}.webp`, `${outBase}.jpg`];
  if (!outputs.every(file => fsSync.existsSync(file))) return false;

  const sourceStat = await fs.stat(source);
  const outputStats = await Promise.all(outputs.map(file => fs.stat(file)));
  return outputStats.every(stat => stat.mtimeMs >= sourceStat.mtimeMs);
}

async function processImage(file, metaMap) {
  const sourceName = path.basename(file);
  const name = normalizeName(sourceName);
  const outBaseName = name;
  const image = sharp(file, { failOn: 'none' });
  const info = await image.metadata();

  if (!info.width || !info.height) {
    console.warn(`Skipping ${sourceName}: no dimensions found`);
    return null;
  }

  const lqip = await lqipBuffer(file);
  metaMap[name] = {
    w: info.width,
    h: info.height,
    lqip: `data:image/jpeg;base64,${lqip.toString('base64')}`
  };

  let generated = false;
  for (const width of TARGET_WIDTHS) {
    const outBase = path.join(outDirForWidth(width), outBaseName);
    if (await isThumbCurrent(file, outBase)) continue;

    const pipeline = sharp(file)
      .resize({ width, withoutEnlargement: true })
      .withMetadata({ orientation: 1 });

    await pipeline.clone().avif(QUAL.avif).toFile(`${outBase}.avif`);
    await pipeline.clone().webp(QUAL.webp).toFile(`${outBase}.webp`);
    await pipeline.clone().jpeg(QUAL.jpeg).toFile(`${outBase}.jpg`);
    generated = true;
  }

  return { name, width: info.width, height: info.height, generated };
}

function upsertConfig(config, processed) {
  const imageOrder = Array.isArray(config.imageOrder) ? [...config.imageOrder] : [];
  const cityByImage = { ...(config.cityByImage || {}) };
  const cropByImage = { ...(config.cropByImage || {}) };

  for (const image of processed) {
    if (!imageOrder.includes(image.name)) {
      imageOrder.push(image.name);
    }

    const existing = cropByImage[image.name] || {};
    const city = existing.city || cityByImage[image.name] || 'Unsorted';
    cityByImage[image.name] = city;
    cropByImage[image.name] = {
      city,
      ...defaultShape(image.width, image.height),
      col: 0,
      row: 0,
      x: 50,
      y: 50,
      ...existing
    };
  }

  return { imageOrder, cityByImage, cropByImage };
}

async function main() {
  await ensureDirs();

  const images = await sourceImages();
  if (!images.length) {
    console.log(`No images found in ${path.relative(ROOT, SOURCE_DIR)}.`);
    console.log('Drop originals there, then run npm run ingest.');
    return;
  }

  const metaMap = await readJson(META_PATH, {});
  const processed = [];
  let generatedCount = 0;

  for (const [index, image] of images.entries()) {
    process.stdout.write(`Ingesting ${index + 1}/${images.length}: ${path.basename(image)}\r`);
    const result = await processImage(image, metaMap);
    if (!result) continue;
    processed.push(result);
    if (result.generated) generatedCount += 1;
  }
  process.stdout.write('\n');

  await fs.writeFile(META_PATH, JSON.stringify(metaMap, null, 2));

  const currentConfig = await readGalleryConfig();
  const nextConfig = upsertConfig(currentConfig, processed);
  await writeGalleryConfig(nextConfig);

  const added = processed.filter(image => !(currentConfig.imageOrder || []).includes(image.name));
  console.log(`Processed ${processed.length} image(s). Regenerated thumbs for ${generatedCount}.`);
  console.log(`Added ${added.length} new config entr${added.length === 1 ? 'y' : 'ies'}.`);
  if (added.length) {
    console.log(`New images: ${added.map(image => image.name).join(', ')}`);
  }
  console.log(`Source: ${path.relative(ROOT, SOURCE_DIR)}`);
  console.log('Next: open gallery-cms.html to assign city/layout/crop visually.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

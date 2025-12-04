import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import sharp from 'sharp';

const [, , inputDirArg, outputDirArg] = process.argv;
if (!inputDirArg || !outputDirArg) {
  console.error('Usage: node thumbgen.js <inputDir> <outputDir>');
  process.exit(1);
}

const INPUT_DIR = path.resolve(process.cwd(), inputDirArg);
const OUTPUT_DIR = path.resolve(process.cwd(), outputDirArg);

// Configure your target widths and qualities here
const TARGET_WIDTHS = [480, 960, 1600];
const QUAL = {
  avif: { quality: 45 },
  webp: { quality: 70 },
  jpeg: { quality: 78, progressive: true, mozjpeg: true }
};

// Toggle copying originals into /originals
const COPY_ORIGINALS = false;

const SUPPORTED = ['.jpg', '.jpeg', '.png', '.heic', '.tif', '.tiff'];

function outDirForWidth(w) { return path.join(OUTPUT_DIR, 'thumbs', `${w}w`); }
function ensureExtJpg(name) {
  // Normalize extension for thumbs (you'll serve avif/webp via <picture> primarily)
  const base = name.replace(/\\.(jpg|jpeg|png|heic|tif|tiff)$/i, '');
  return base;
}

async function ensureDirs() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const w of TARGET_WIDTHS) {
    await fs.mkdir(outDirForWidth(w), { recursive: true });
  }
  if (COPY_ORIGINALS) {
    await fs.mkdir(path.join(OUTPUT_DIR, 'originals'), { recursive: true });
  }
}

async function lqipBuffer(input) {
  // Small blurred placeholder ~24px wide, JPEG
  return await sharp(input)
    .resize({ width: 24, withoutEnlargement: true })
    .blur()
    .jpeg({ quality: 35 })
    .toBuffer();
}

async function processImage(file, metaMap) {
  const ext = path.extname(file).toLowerCase();
  if (!SUPPORTED.includes(ext)) return;

  const baseName = path.basename(file);
  const baseNoExt = ensureExtJpg(baseName);

  const image = sharp(file, { failOn: 'none' });
  const info = await image.metadata();

  if (!info.width || !info.height) {
    console.warn(`Skipping (no dimensions): ${file}`);
    return;
  }

  // LQIP
  const lqip = await lqipBuffer(file);
  const lqipDataUrl = `data:image/jpeg;base64,${lqip.toString('base64')}`;

  // Save meta
  metaMap[baseName] = { w: info.width, h: info.height, lqip: lqipDataUrl };

  // Optionally copy originals
  if (COPY_ORIGINALS) {
    const dest = path.join(OUTPUT_DIR, 'originals', baseName);
    await fs.copyFile(file, dest);
  }

  // Generate each width in AVIF/WebP/JPEG
  for (const w of TARGET_WIDTHS) {
    const pipeline = sharp(file).resize({ width: w, withoutEnlargement: true }).withMetadata({ orientation: 1 });
    const outBase = path.join(outDirForWidth(w), baseNoExt);

    // AVIF
    await pipeline.clone().avif(QUAL.avif).toFile(`${outBase}.avif`);
    // WebP
    await pipeline.clone().webp(QUAL.webp).toFile(`${outBase}.webp`);
    // JPEG (progressive)
    await pipeline.clone().jpeg(QUAL.jpeg).toFile(`${outBase}.jpg`);
  }
}

async function main() {
  await ensureDirs();

  const entries = await fg(['**/*'], { cwd: INPUT_DIR, dot: false, absolute: true });
  const images = entries.filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()));

  if (images.length === 0) {
    console.error(`No images found in ${INPUT_DIR}. Supported: ${SUPPORTED.join(', ')}`);
    process.exit(1);
  }

  const metaMap = {};
  for (const [i, img] of images.entries()) {
    process.stdout.write(`Processing ${i + 1}/${images.length}: ${path.basename(img)}\\r`);
    await processImage(img, metaMap);
  }
  process.stdout.write('\\n');

  // Write imageMeta.json
  const metaPath = path.join(OUTPUT_DIR, 'imageMeta.json');
  await fs.writeFile(metaPath, JSON.stringify(metaMap, null, 2));

  console.log(`Done. Wrote thumbnails to ${path.join(OUTPUT_DIR, 'thumbs')}`);
  console.log(`Meta file: ${metaPath}`);
  if (COPY_ORIGINALS) {
    console.log(`Originals copied to: ${path.join(OUTPUT_DIR, 'originals')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
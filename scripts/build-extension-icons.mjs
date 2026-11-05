// Render the original scribble on the approved yellow circular badge.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const mark = await readFile(new URL('../extension/brand/scribble-circle-yellow.svg', import.meta.url));
const directory = new URL('../extension/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  // Optical weights keep the original paths legible at small toolbar sizes.
  const weight = { 16: 24, 32: 14, 48: 10, 128: 8 }[size];
  const optical = Buffer.from(mark.toString().replaceAll('stroke-width="8"', `stroke-width="${weight}"`));
  const png = await sharp(optical, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(new URL(`scribble-${size}.png`, directory), png);
}
console.log('Rendered yellow-circle scribble icons with transparent corners at 16, 32, 48 and 128px.');

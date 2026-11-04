// Render the approved bold original scribble as extension UI assets.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const mark = await readFile(new URL('../extension/brand/scribble-bold.svg', import.meta.url));
const directory = new URL('../extension/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = await sharp(mark, { density: 384 })
    .resize(size, size, { fit: 'contain', background: '#000000' })
    .flatten({ background: '#000000' })
    .png()
    .toBuffer();
  await writeFile(new URL(`scribble-${size}.png`, directory), png);
}
console.log('Rendered bold original scribble icons at 16, 32, 48 and 128px.');

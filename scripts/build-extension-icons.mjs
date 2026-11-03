// Render the original brand mark as extension UI assets. No replacement logo.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og.js';
import { createElement } from 'react';

const mark = await readFile(new URL('../web/public/static/tangle-white.png', import.meta.url));
const directory = new URL('../extension/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const response = new ImageResponse(createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#000000' },
  }, createElement('img', {
    src: `data:image/png;base64,${mark.toString('base64')}`, width: size * .94, height: size * .97,
  })), { width: size, height: size });
  await writeFile(new URL(`scribble-${size}.png`, directory), Buffer.from(await response.arrayBuffer()));
}
console.log('Rendered original scribble icons at 16, 32, 48 and 128px.');

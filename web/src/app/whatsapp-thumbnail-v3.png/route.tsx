import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

/** Square artwork lets messaging clients choose a compact thumbnail preview. */
export async function GET() {
  const mark = await readFile(join(process.cwd(), 'public/static/tangle-white.png'));
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#000000' }}>
      <img src={`data:image/png;base64,${mark.toString('base64')}`} alt="" width={260} height={269} />
    </div>,
    { width: 320, height: 320, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}

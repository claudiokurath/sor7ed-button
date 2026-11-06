import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock('../ssrf-guard.js', () => ({ safeFetch: mocks.safeFetch }));
import { brandCardImage, renderSavedCardImage, savedCardImageUrl, validCardImageSignature } from './card-images.js';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); mocks.safeFetch.mockReset(); });
const response = (bytes: Buffer, type = 'image/png') => new Response(new Uint8Array(bytes), { headers: { 'content-type': type } });

describe('consistent saved-image frames', () => {
  it('produces a sharp yellow/black 1200×630 fallback for missing, small, corrupt, blocked and non-image sources', async () => {
    const fallback = await brandCardImage();
    expect(await sharp(fallback).metadata()).toMatchObject({width:1200,height:630,format:'jpeg'});
    const small = await sharp({create:{width:64,height:64,channels:3,background:'red'}}).png().toBuffer();
    for (const setup of [() => mocks.safeFetch.mockResolvedValue(response(small)), () => mocks.safeFetch.mockRejectedValue(Error('Blocked private target')),
      () => mocks.safeFetch.mockResolvedValue(response(Buffer.from('corrupt'))), () => mocks.safeFetch.mockResolvedValue(response(Buffer.from('<svg/>'),'image/svg+xml'))]) {
      setup();expect(await renderSavedCardImage('https://source.example/image.png')).toEqual(fallback);
    }
    mocks.safeFetch.mockReset();expect(await renderSavedCardImage(null)).toEqual(fallback);
    expect(await renderSavedCardImage('http://source.example/image.png')).toEqual(fallback);
    expect(mocks.safeFetch).not.toHaveBeenCalled();
    const pixel = await sharp(fallback).extract({left:600,top:138,width:1,height:1}).raw().toBuffer();
    expect(pixel[0]).toBeGreaterThan(220);expect(pixel[1]).toBeGreaterThan(160);expect(pixel[2]).toBeLessThan(35);
  });
  it('preserves a portrait image without stretching or upscaling and pads it into the same landscape frame', async () => {
    const source = await sharp({create:{width:600,height:900,channels:3,background:'#ff0000'}}).png().toBuffer();
    mocks.safeFetch.mockResolvedValue(response(source));
    const image=await renderSavedCardImage('https://source.example/portrait.png');
    expect(await sharp(image).metadata()).toMatchObject({width:1200,height:630,format:'jpeg'});
    const center = await sharp(image).extract({left:600,top:315,width:1,height:1}).raw().toBuffer();
    const side = await sharp(image).extract({left:300,top:315,width:1,height:1}).raw().toBuffer();
    expect(center[0]).toBeGreaterThan(240);expect(side[0]).toBeLessThan(10);
    expect(mocks.safeFetch.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });
  it('limits the streamed image body rather than trusting Content-Length', async () => {
    const huge=Buffer.alloc(3*1024*1024+1);
    mocks.safeFetch.mockResolvedValue(response(huge));
    expect(await renderSavedCardImage('https://source.example/huge.png')).toEqual(await brandCardImage());
  });
  it('returns the fallback within the deadline even if the source lookup never finishes', async () => {
    const fallback=await brandCardImage();
    vi.useFakeTimers();mocks.safeFetch.mockImplementation(()=>new Promise(()=>{}));
    const pending=renderSavedCardImage('https://slow.example/image.png');
    await vi.advanceTimersByTimeAsync(4001);
    expect(await pending).toEqual(fallback);
    expect(mocks.safeFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });
  it('binds the image capability to its own saved item and purpose', () => {
    vi.stubEnv('JWT_SECRET','fixture-signing-key');vi.stubEnv('API_BASE_URL','https://api.sor7ed.com');
    const url=new URL(savedCardImageUrl('abc123def456')),sig=url.searchParams.get('signature')!;
    expect(validCardImageSignature('abc123def456',sig,'fixture-signing-key')).toBe(true);
    expect(validCardImageSignature('different-item',sig,'fixture-signing-key')).toBe(false);
    expect(validCardImageSignature('abc123def456',sig,'other-key')).toBe(false);
    expect(validCardImageSignature('abc123def456','bad','fixture-signing-key')).toBe(false);
    expect(url.hostname).toBe('api.sor7ed.com');expect(url.searchParams.size).toBe(1);
  });
});

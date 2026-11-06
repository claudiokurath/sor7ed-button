import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { savedCardImageUrl, validCardImageSignature } from '@sor7ed/core/src/whatsapp/card-images.js';
const f=vi.hoisted(()=>({read:vi.fn(),render:vi.fn(),brand:vi.fn()}));
vi.mock('@sor7ed/core',()=>({
  db:{select:()=>({from:()=>({where:()=>({limit:f.read})})})},savedItems:{imageUrl:'image',cachedImageUrl:'cached',shortId:'shortId'},
  renderSavedCardImage:f.render,brandCardImage:f.brand,
  validCardImageSignature:(...args: Parameters<typeof validCardImageSignature>)=>validCardImageSignature(...args),
}));
import { cardImageRoutes } from './card-images.js';

describe('signed saved-image route',()=>{
  beforeEach(()=>{vi.stubEnv('JWT_SECRET','fixture-image-key');vi.stubEnv('API_BASE_URL','https://api.sor7ed.com');f.read.mockReset().mockResolvedValue([{image:'https://source.example/picture.png',cached:null}]);f.render.mockReset().mockResolvedValue(Buffer.from('fixture-jpeg'));f.brand.mockReset().mockResolvedValue(Buffer.from('brand-jpeg'))});
  afterEach(()=>vi.unstubAllEnvs());
  async function app(){const a=Fastify();await a.register(cardImageRoutes);return a}
  it('rejects guessed and tampered image capabilities before reading or fetching anything',async()=>{
    const a=await app();try{
      for(const url of ['/api/card-images/abc123def456','/api/card-images/abc123def456?signature='+'a'.repeat(64)])expect((await a.inject({url})).statusCode).toBe(403);
      expect(f.read).not.toHaveBeenCalled();expect(f.render).not.toHaveBeenCalled();
    }finally{await a.close()}
  });
  it('serves only image bytes and never exposes the saved URL or account metadata',async()=>{
    const a=await app();try{
      const u=new URL(savedCardImageUrl('abc123def456'));
      const r=await a.inject({url:u.pathname+u.search});
      expect(r.statusCode).toBe(200);expect(r.headers['content-type']).toBe('image/jpeg');expect(r.headers['x-content-type-options']).toBe('nosniff');expect(r.body).toBe('fixture-jpeg');
      expect(f.render).toHaveBeenCalledWith('https://source.example/picture.png');
      f.read.mockRejectedValueOnce(Error('temporary DB failure'));
      expect((await a.inject({url:u.pathname+u.search})).statusCode).toBe(200);expect(f.render).toHaveBeenLastCalledWith(null);
    }finally{await a.close()}
  });
  it('offers public brand artwork without reading a customer record',async()=>{
    const a=await app();try{const r=await a.inject({url:'/api/card-images/brand'});expect(r.statusCode).toBe(200);expect(r.body).toBe('brand-jpeg');expect(f.read).not.toHaveBeenCalled()}finally{await a.close()}
  });
});

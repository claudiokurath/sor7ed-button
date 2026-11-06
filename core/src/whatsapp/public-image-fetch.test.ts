import {afterEach,expect,it,vi} from 'vitest';
import {Readable} from 'node:stream';
const f=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock('node:dns/promises',()=>({default:{lookup:f.lookup}}));
vi.mock('node:https',()=>({request:f.request}));
import {fetchPublicImage,imageLookup,isPublicImageAddress} from './public-image-fetch.js';
afterEach(()=>{f.lookup.mockReset();f.request.mockReset()});
it('refuses private, local, mapped and non-routable address families',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','224.1.2.3','::1','::ffff:127.0.0.1','fe90::1','fd00::1','2001:db8::1'])expect(isPublicImageAddress(ip)).toBe(false);
 for(const ip of ['93.184.216.34','1.1.1.1','2606:4700:4700::1111'])expect(isPublicImageAddress(ip)).toBe(true);
});
it('pins the exact public DNS results and refuses mixed public/private answers',async()=>{
 const records=[{address:'93.184.216.34',family:4},{address:'2606:4700:4700::1111',family:6}];
 f.lookup.mockResolvedValue(records);
 await new Promise<void>((resolve,reject)=>imageLookup('source.example',{all:true},(error,addresses)=>{if(error)return reject(error);expect(addresses).toEqual(records);resolve()}));
 expect(f.lookup).toHaveBeenCalledTimes(1);
 f.lookup.mockResolvedValue([{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]);
 await expect(new Promise((resolve,reject)=>imageLookup('source.example',{},(error,address)=>error?reject(error):resolve(address)))).rejects.toThrow('not public');
});
it('validates each redirect and supplies pinned lookup and abort control to HTTPS',async()=>{
 const requested:URL[]=[],options:any[]=[];
 f.request.mockImplementation((url,opts,callback)=>{
  requested.push(url);options.push(opts);
  return {on(){return this},end(){const res=Readable.from([]) as any;res.headers={location:'https://127.0.0.1/private'};res.statusCode=302;callback(res)}};
 });
 await expect(fetchPublicImage('https://source.example/photo',{signal:new AbortController().signal})).rejects.toThrow('not public HTTPS');
 expect(requested).toHaveLength(1);expect(options[0].lookup).toBe(imageLookup);expect(options[0].signal).toBeInstanceOf(AbortSignal);
 expect(options[0].headers.cookie).toBeUndefined();expect(options[0].headers.authorization).toBeUndefined();
});
it('does not follow insecure redirects or embedded credentials',async()=>{
 for(const url of ['http://example.com/image','https://user:pass@example.com/image','https://[::ffff:127.0.0.1]/image'])await expect(fetchPublicImage(url,{signal:new AbortController().signal})).rejects.toThrow();
 expect(f.request).not.toHaveBeenCalled();
});
it('handles an empty image response without an uncaught Response construction error',async()=>{
 f.request.mockImplementation((_url,_opts,callback)=>({on(){return this},end(){const res=Readable.from([]) as any;res.headers={};res.statusCode=204;callback(res)}}));
 expect((await fetchPublicImage('https://source.example/empty',{signal:new AbortController().signal})).status).toBe(204);
});

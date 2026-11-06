import dns from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';

const denied = new BlockList();
for (const [address,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) denied.addSubnet(address,bits,'ipv4');
const globalV6 = new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
for (const [address,bits] of [['2001::',32],['2001:db8::',32],['2002::',16]] as const) denied.addSubnet(address,bits,'ipv6');

export function isPublicImageAddress(address: string): boolean {
  const family=isIP(address);
  return family===4 ? !denied.check(address,'ipv4') : family===6 && globalV6.check(address,'ipv6') && !denied.check(address,'ipv6');
}

/** Resolve once and pass those exact approved addresses to the TLS socket. */
export const imageLookup: LookupFunction = (host,options,callback) => {
  void dns.lookup(host,{all:true,verbatim:true}).then(records=>{
    if (!records.length || records.some(record=>!isPublicImageAddress(record.address))) throw new Error('Image host is not public');
    if (options.all) callback(null,records);
    else callback(null,records[0]!.address,records[0]!.family);
  }).catch(error=>callback(error as NodeJS.ErrnoException,''));
};

function validate(raw: string): URL {
  const url=new URL(raw),host=url.hostname.replace(/^\[|\]$/g,'');
  if (url.protocol!=='https:' || url.username || url.password || (isIP(host) && !isPublicImageAddress(host))) throw new Error('Image host is not public HTTPS');
  return url;
}
function fetchOnce(url: URL,signal: AbortSignal): Promise<Response> {
  return new Promise((resolve,reject)=>{
    const req=request(url,{method:'GET',signal,lookup:imageLookup,headers:{accept:'image/jpeg, image/png, image/webp', 'user-agent':'SOR7ED/1.0 (+https://www.sor7ed.com)'}},res=>{
      const headers=new Headers();
      for(const [key,value] of Object.entries(res.headers)) if(value!==undefined) headers.set(key,Array.isArray(value)?value.join(', '):value);
      // Native streams preserve cancellation and transfer backpressure. No page
      // cookies or authentication headers are copied to the remote image host.
      try {
        const status=res.statusCode || 502;
        const noBody=[204,205,304].includes(status);
        if (noBody) res.resume();
        resolve(new Response(noBody ? null : Readable.toWeb(res) as ReadableStream<Uint8Array>,{status,headers}));
      } catch (error) { res.destroy();reject(error); }
    });
    req.on('error',reject);req.end();
  });
}

export async function fetchPublicImage(raw: string,options: {signal: AbortSignal}): Promise<Response> {
  let url=validate(raw);
  for(let hop=0;;hop++) {
    const response=await fetchOnce(url,options.signal);
    if(![301,302,303,307,308].includes(response.status)) return response;
    const location=response.headers.get('location');
    await response.body?.cancel();
    if(!location || hop>=3) throw new Error('Image redirect is unavailable');
    url=validate(new URL(location,url).href);
  }
}

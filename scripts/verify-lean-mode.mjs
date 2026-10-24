import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Never falls back to DATABASE_URL and never accepts remote/customer databases.
const databaseUrl = process.env.SOR7ED_LEAN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set SOR7ED_LEAN_TEST_DATABASE_URL to a disposable local database');
const parsed = new URL(databaseUrl);
assert(['127.0.0.1', 'localhost'].includes(parsed.hostname));
assert.equal(parsed.pathname, '/sor7ed_lean_tests');
assert.equal(parsed.username, 'sor7ed_test');
const pool = new pg.Pool({ connectionString: databaseUrl });
const processes = [];
const outbound = [];
const logs = [];
let omitMessageId = false;
const testSecret = 'isolated-test-secret-never-use-in-production';
const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  const message = JSON.parse(raw);
  if (req.url === '/relay-messages') {
    const sig = createHmac('sha256', testSecret).update(`outbound\n${req.headers['x-sor7ed-ts']}\n${req.headers['x-sor7ed-id']}\n${raw}`).digest('hex');
    assert.equal(req.headers['x-sor7ed-signature'], sig);
    assert.equal(req.headers.authorization, undefined);
  }
  outbound.push(message);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(omitMessageId ? {} : { messages: [{ id: `wamid.test-${outbound.length}` }] }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(fn) {
  for (let n = 0; n < 80; n++) { if (await fn()) return; await sleep(100); }
  throw new Error('Timed out waiting for integration state');
}
async function port() {
  const s = createNetServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const p = s.address().port; await new Promise(r => s.close(r)); return p;
}
function cookie(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now()/1000)+600 })).toString('base64url');
  return `sor7ed_session=${header}.${payload}.${createHmac('sha256', testSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
async function api(base, path, options = {}) {
  if (!options.body && options.method === 'DELETE') { options.headers = { ...options.headers }; delete options.headers['content-type']; }
  const response = await fetch(base+path, { redirect: 'manual', ...options });
  const text = await response.text();
  return { status: response.status, cookie: response.headers.get("set-cookie"), body: text ? JSON.parse(text) : null };
}
async function start(metaUrl, google = true, relay = false) {
  const p = await port(); const base = `http://127.0.0.1:${p}`;
  const env = { ...process.env, NODE_ENV:'production', BUTTON_MODE:'lean', PORT:String(p),
    DATABASE_URL:databaseUrl, BASE_URL:base, API_BASE_URL:base, WEB_ORIGIN:base,
    JWT_SECRET:testSecret, META_APP_SECRET:testSecret, META_WEBHOOK_VERIFY_TOKEN:'test-only',
    META_WHATSAPP_TOKEN:'mock-only', META_WHATSAPP_PHONE_ID:'mock-only',
    META_WHATSAPP_DISPLAY_NUMBER:'447700900123', GOOGLE_CLIENT_ID:'mock-only',
    GOOGLE_CLIENT_SECRET:'mock-only', SOR7ED_TEST_META_URL:metaUrl };
  for (const key of Object.keys(env)) if (key.startsWith('R2_') || key === 'REDIS_URL' || key === 'OPENAI_API_KEY' || key === 'VERCEL') delete env[key];
  if (!google) { delete env.GOOGLE_CLIENT_ID; delete env.GOOGLE_CLIENT_SECRET; }
  if (relay) {
    env.WHATSAPP_TRANSPORT = 'relay'; env.WHATSAPP_RELAY_SECRET = testSecret;
    env.WHATSAPP_RELAY_URL = 'https://www.planetsorted.com/api/button/whatsapp';
    delete env.META_WHATSAPP_TOKEN; delete env.META_WHATSAPP_PHONE_ID; delete env.META_APP_SECRET;
  }
  const child = spawn(process.execPath, ['--import', './scripts/mock-meta-for-lean-tests.mjs', 'api/dist/index.js'], { env, stdio:['ignore','pipe','pipe'] });
  processes.push(child);
  child.stdout.on('data', b => logs.push(b.toString())); child.stderr.on('data', b => logs.push(b.toString()));
  await eventually(async () => { if (child.exitCode !== null) throw new Error('API exited before startup'); try { return (await fetch(base+'/health')).status === 200; } catch { return false; } });
  return base;
}
try {
  await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public');
  await migrate(drizzle(pool), { migrationsFolder:'core/src/migrations' });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const metaUrl = `http://127.0.0.1:${mock.address().port}`;
  const base = await start(metaUrl);
  assert.equal((await api(base,'/health')).body.redis, 'disabled');
  const user = randomUUID(), other = randomUUID(), partner = randomUUID();
  await pool.query('insert into users(id,email) values($1,$2),($3,$4)',[user,'lean-one@example.invalid',other,'lean-two@example.invalid']);
  await pool.query("insert into partners(id,name,api_key,allowed_domains) values($1,'Lean fixture','lean-test-key',ARRAY['example.com'])",[partner]);
  const headers = { cookie:cookie(user), 'content-type':'application/json' };
  assert.equal((await api(base,'/api/saves',{ method:'POST', headers:{'content-type':'application/json'}, body:'{}' })).status,401);
  const me = await api(base,'/api/auth/me',{headers});
  assert.equal(me.body.requiresActiveSession,true); assert.equal(me.body.whatsappSessionOpen,false);
  const connection = await api(base,'/api/whatsapp/connect',{method:'POST',headers,body:'{}'});
  assert.equal(connection.status,200);
  async function inbound(command, valid = true) {
    const body = JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{messages:[{from:'447700900123',type:'text',text:{body:command}}]}}]}]});
    return fetch(base+'/webhook/whatsapp',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':valid ? 'sha256='+createHmac('sha256',testSecret).update(body).digest('hex') : 'invalid'},body});
  }
  const connectCommand = new URL(connection.body.url).searchParams.get('text');
  assert.equal((await inbound(connectCommand,false)).status,401);
  assert.equal((await inbound(connectCommand)).status,200);
  await eventually(async () => (await api(base,'/api/auth/me',{headers})).body.whatsappSessionOpen);
  console.log('PASS: lean production boot without Redis/R2; signed first connection opens the service window');
  const body = {partnerApiKey:'lean-test-key',url:'https://example.com/page',title:'Lean resource',imageUrl:'https://example.com/preview.jpg',idempotencyKey:randomUUID()};
  const save = data => api(base,'/api/saves',{method:'POST',headers,body:JSON.stringify(data)});
  const saved = await save(body); assert.equal(saved.status,201); assert.equal(saved.body.deliveryStatus,'accepted');
  const count = outbound.length;
  assert.equal((await save(body)).status,200); assert.equal(outbound.length,count);
  assert(!outbound.at(-1).text.body.includes('REMIND'));
  assert.equal((await api(base,`/api/saves/${saved.body.shortId}`)).body.cachedImageUrl,body.imageUrl);
  assert.equal((await api(base,`/api/saves/status/${saved.body.shortId}`,{headers:{cookie:cookie(other)}})).status,404);
  assert.equal((await save({...body,url:'http://127.0.0.1/private',idempotencyKey:randomUUID()})).status,403);
  console.log('PASS: automatic send, original preview, duplicate protection, domain restrictions and status ownership');
  omitMessageId = true;
  const uncertain = {...body,title:'Unconfirmed',idempotencyKey:randomUUID()};
  assert.equal((await save(uncertain)).body.deliveryStatus,'unknown'); const attempts = outbound.length;
  await save(uncertain); assert.equal(outbound.length,attempts); omitMessageId=false;
  await pool.query("update users set last_inbound_message_at=now()-interval '25 hours' where id=$1",[user]);
  assert.equal((await api(base,'/api/auth/me',{headers})).body.whatsappSessionOpen,false);
  const closed = await save({...body,idempotencyKey:randomUUID()});
  assert.equal(closed.body.deliveryReason,'session_closed'); assert.equal(outbound.length,attempts);
  await inbound('REMIND tomorrow'); await eventually(() => outbound.length > attempts);
  assert(outbound.at(-1).text.body.includes("Reminders aren't available"));
  assert.equal((await pool.query('select count(*)::int n from saved_items where reminder_at is not null')).rows[0].n,0);
  await inbound('STOP'); await eventually(async()=>Boolean((await pool.query('select whatsapp_opted_out_at from users where id=$1',[user])).rows[0].whatsapp_opted_out_at));
  assert.equal((await save({...body,idempotencyKey:randomUUID()})).body.deliveryReason,'opted_out');
  await inbound('START'); await eventually(async()=>!(await pool.query('select whatsapp_opted_out_at from users where id=$1',[user])).rows[0].whatsapp_opted_out_at);
  assert(outbound.every(message => message.type !== 'template'));
  console.log('PASS: unknown outcomes never resend; expired windows never request templates; reminders disabled and STOP honoured');
  await pool.query("update partners set saves_this_month=100,quota_period_start=date_trunc('month',now())-interval '1 month' where id=$1",[partner]);
  assert.equal((await save({...body,idempotencyKey:randomUUID()})).status,201);
  assert.equal((await pool.query('select saves_this_month from partners where id=$1',[partner])).rows[0].saves_this_month,1);
  await pool.query('update partners set saves_this_month=0, monthly_save_limit=5 where id=$1',[partner]);
  const race = await Promise.all(Array.from({length:12},()=>save({...body,idempotencyKey:randomUUID()})));
  assert.equal(race.filter(r=>r.status===201).length,5); assert.equal(race.filter(r=>r.status===429).length,7);
  assert.equal((await pool.query('select saves_this_month from partners where id=$1',[partner])).rows[0].saves_this_month,5);
  console.log('PASS: lazy monthly reset and concurrent quota limit remain atomic without a scheduler');
  // Browser proof + code possession are both required; no phone enumeration.
  const consumerHeaders = { ...headers, origin: base };
  const post = (path,data,override=consumerHeaders) => api(base,path,{method:'POST',headers:override,body:JSON.stringify(data)});
  assert.equal((await post('/api/signin/challenge',{}, {...consumerHeaders,origin:'https://attacker.invalid'})).status,403);
  const challenge=await post('/api/signin/challenge',{});assert.equal(challenge.status,200);
  const beforeSignin=outbound.length;
  await inbound(`SIGNIN-${challenge.body.token}`);
  await eventually(()=>outbound.length>beforeSignin);
  const code=outbound.at(-1).text.body.match(/code is (\d{6})/)[1];
  const proof=challenge.body.proof, token=challenge.body.token, id=challenge.body.id;
  assert.equal((await post('/api/signin/verify',{id,proof:'0'.repeat(64),token,code})).status,401);
  await inbound(`SIGNIN-${token}`);await sleep(200);assert.equal(outbound.length,beforeSignin+1);
  const signedIn=await post('/api/signin/verify',{id,proof,token,code});assert.equal(signedIn.status,200);assert(signedIn.cookie.includes('HttpOnly'));assert(signedIn.cookie.includes('Secure'));assert.equal((await api(base,'/api/account',{headers:{cookie:signedIn.cookie.split(';')[0]}})).status,200);
  assert.equal((await post('/api/signin/verify',{id,proof,token,code})).status,401);
  const locked=await post('/api/signin/challenge',{});const b=locked.body;
  await inbound(`SIGNIN-${b.token}`);await eventually(()=>outbound.length>beforeSignin+1);
  const real=outbound.at(-1).text.body.match(/code is (\d{6})/)[1];const wrong=real==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)assert.equal((await post('/api/signin/verify',{id:b.id,token:b.token,proof:b.proof,code:wrong})).status,401);
  assert.equal((await post('/api/signin/verify',{id:b.id,token:b.token,proof:b.proof,code:real})).status,401);
  const exp=await post('/api/signin/challenge',{});await pool.query("update whatsapp_signin_challenges set expires_at=now()-interval '1 second' where id=$1",[exp.body.id]);
  assert.equal((await post('/api/signin/verify',{id:exp.body.id,token:exp.body.token,proof:exp.body.proof,code:'000000'})).status,401);
  console.log('PASS: signed WhatsApp sign-in, browser proof, code expiry, five-attempt lock and single-use challenge');
  const draft={url:'https://example.org/resource',title:'Personal fixture',idempotencyKey:randomUUID()};
  const c0=outbound.length;
  const personalRace=await Promise.all(Array.from({length:8},()=>post('/api/personal-saves',draft)));
  assert.equal(personalRace.filter(r=>r.status===201).length,1);assert.equal(outbound.length,c0+1);
  const personal=personalRace.find(r=>r.status===201).body;
  assert.equal((await post('/api/personal-saves',{...draft,title:'Changed'})).status,409);
  assert.equal((await post('/api/personal-saves',{...draft,url:'http://127.0.0.1',idempotencyKey:randomUUID()})).status,400);
  const strangerHeaders={...consumerHeaders,cookie:cookie(other)};
  assert.equal((await api(base,`/api/account/items/${personal.shortId}`,{method:'DELETE',headers:strangerHeaders})).status,404);
  const ak=randomUUID();
  assert.equal((await post(`/api/account/items/${personal.shortId}/resend`,{actionKey:ak,confirmed:true})).body.deliveryStatus,'accepted');assert.equal(outbound.length,c0+1);
  await pool.query("update saved_items set delivery_status='unknown' where short_id=$1",[personal.shortId]);
  const resendKey=randomUUID(),rcount=outbound.length;
  const resendRace=await Promise.all(Array.from({length:6},()=>post(`/api/account/items/${personal.shortId}/resend`,{actionKey:resendKey,confirmed:true})));
  assert(resendRace.every(r=>r.status===200));assert.equal(outbound.length,rcount+1);
  assert.equal((await post('/api/account/profile',{displayName:'Lean Person',paused:true})).status,200);
  const paused=await post('/api/personal-saves',{...draft,idempotencyKey:randomUUID()});assert.equal(paused.body.deliveryReason,'opted_out');
  assert.equal((await api(base,'/api/account',{headers:consumerHeaders})).body.profile.displayName,'Lean Person');
  await post('/api/account/profile',{displayName:'Lean Person',paused:false});
  assert.equal((await api(base,`/api/account/items/${personal.shortId}`,{method:'DELETE',headers:consumerHeaders})).status,204);
  assert.equal((await api(base,`/api/saves/status/${personal.shortId}`,{headers:consumerHeaders})).status,404);
  const owner=await pool.query('insert into users(email) values($1) returning id',['deletion@example.invalid']);
  const deleteHeaders={...consumerHeaders,cookie:cookie(owner.rows[0].id)};
  await post('/api/personal-saves',{...draft,idempotencyKey:randomUUID()},deleteHeaders);
  assert.equal((await api(base,'/api/account',{method:'DELETE',headers:deleteHeaders})).status,200);
  assert.equal((await api(base,'/api/account',{headers:deleteHeaders})).status,401);
  assert.equal((await pool.query('select count(*)::int n from saved_items where user_id=$1',[owner.rows[0].id])).rows[0].n,0);
  console.log('PASS: concurrent personal-save and resend idempotency, ownership, profile/pause and cascading account deletion');

  const second = await start(metaUrl, false);
  assert.equal((await api(second,'/api/auth/google/callback')).status,503);
  const login=await fetch(second+'/api/auth/login?returnTo='+encodeURIComponent(second+'/save?url=https%3A%2F%2Fexample.com'),{redirect:'manual'});
  assert(new URL(login.headers.get('location')).searchParams.get('next').startsWith('/save?'));
  const rejected=await fetch(second+'/api/auth/login?returnTo='+encodeURIComponent('https://attacker.invalid'),{redirect:'manual'});
  assert.equal(new URL(rejected.headers.get('location')).searchParams.get('next'),'/account');
  // Reset only fixture counters before the separate two-instance budget check.
  await pool.query('delete from button_rate_limits');
  const statuses=[];
  for(let i=0;i<22;i++) statuses.push((await fetch((i%2 ? second : base)+'/api/auth/login',{redirect:'manual'})).status);
  assert.equal(statuses.filter(s=>s===302).length,20); assert.equal(statuses.filter(s=>s===429).length,2);
  await pool.query("update button_rate_limits set expires_at=now()-interval '1 second'");
  assert.equal((await fetch(base+'/api/auth/login',{redirect:'manual'})).status,302);
  console.log('PASS: shared Postgres rate limit spans two API processes and expires correctly');

  {
  const relayBase = await start(metaUrl, false, true);
  const relayHeaders = { 'content-type': 'application/json', origin: relayBase };
  const challenge = await api(relayBase, '/api/signin/challenge', { method: 'POST', headers: relayHeaders, body: '{}' });
  assert.equal(challenge.status, 200);
  const relayPhone = '447700900124';
  const event = JSON.stringify({ mode: 'command', message: { from: relayPhone, type: 'text', text: { body: `SIGNIN-${challenge.body.token}` } } });
  const eventId = randomUUID(), timestamp = String(Date.now());
  const signedHeaders = { ...relayHeaders, 'x-sor7ed-id': eventId, 'x-sor7ed-ts': timestamp, 'x-sor7ed-signature': createHmac('sha256', testSecret).update(`inbound\n${timestamp}\n${eventId}\n${event}`).digest('hex') };
  assert.equal((await api(relayBase, '/webhook/relay', { method: 'POST', headers: relayHeaders, body: event })).status, 401);
  const beforeRelay = outbound.length;
  assert.equal((await api(relayBase, '/webhook/relay', { method: 'POST', headers: signedHeaders, body: event })).status, 200);
  await eventually(() => outbound.length === beforeRelay + 1);
  assert.equal((await api(relayBase, '/webhook/relay', { method: 'POST', headers: signedHeaders, body: event })).body.duplicate, true);
  assert.equal(outbound.length, beforeRelay + 1);
  const relayCode = outbound.at(-1).text.body.match(/code is (\d{6})/)[1];
  const verifiedRelay = await api(relayBase, '/api/signin/verify', { method: 'POST', headers: relayHeaders, body: JSON.stringify({ id: challenge.body.id, token: challenge.body.token, proof: challenge.body.proof, code: relayCode }) });
  assert.equal(verifiedRelay.status, 200);
  const relayCookie = verifiedRelay.cookie.split(';')[0];
  const relaySave = await api(relayBase, '/api/personal-saves', { method: 'POST', headers: { ...relayHeaders, cookie: relayCookie }, body: JSON.stringify({ url: 'https://example.org/relay', title: 'Relay fixture', idempotencyKey: randomUUID() }) });
  assert.equal(relaySave.status, 201); assert.equal(relaySave.body.deliveryStatus, 'accepted');
  async function sharedConsent(command) {
    const raw = JSON.stringify({ mode: 'session', message: { from: relayPhone, type: 'text', text: { body: command } } });
    const time = String(Date.now()), key = randomUUID();
    return api(relayBase, '/webhook/relay', { method: 'POST', headers: { ...relayHeaders, 'x-sor7ed-ts': time, 'x-sor7ed-id': key, 'x-sor7ed-signature': createHmac('sha256', testSecret).update(`inbound\n${time}\n${key}\n${raw}`).digest('hex') }, body: raw });
  }
  const noExtraReplies = outbound.length;
  await sharedConsent('STOP');
  await eventually(async () => Boolean((await pool.query('select whatsapp_opted_out_at from users where whatsapp_number=$1', [relayPhone])).rows[0].whatsapp_opted_out_at));
  assert.equal(outbound.length, noExtraReplies);
  await sharedConsent('START');
  await eventually(async () => !(await pool.query('select whatsapp_opted_out_at from users where whatsapp_number=$1', [relayPhone])).rows[0].whatsapp_opted_out_at);
  assert.equal(outbound.length, noExtraReplies);
  console.log('PASS: relay production boot without Meta secrets; signed sign-in and personal save; duplicate rejection and silent shared STOP/START');
  }
} catch (error) {
  console.error(logs.join('').slice(-7000)); throw error;
} finally {
  for(const child of processes) child.kill('SIGTERM');
  await pool.end(); await new Promise(r=>mock.close(r));
}

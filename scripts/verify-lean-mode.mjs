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
  const message = JSON.parse(Buffer.concat(chunks).toString());
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
  const response = await fetch(base+path, { redirect: 'manual', ...options });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
async function start(metaUrl) {
  const p = await port(); const base = `http://127.0.0.1:${p}`;
  const env = { ...process.env, NODE_ENV:'production', BUTTON_MODE:'lean', PORT:String(p),
    DATABASE_URL:databaseUrl, BASE_URL:base, API_BASE_URL:base, WEB_ORIGIN:base,
    JWT_SECRET:testSecret, META_APP_SECRET:testSecret, META_WEBHOOK_VERIFY_TOKEN:'test-only',
    META_WHATSAPP_TOKEN:'mock-only', META_WHATSAPP_PHONE_ID:'mock-only',
    META_WHATSAPP_DISPLAY_NUMBER:'447700900123', GOOGLE_CLIENT_ID:'mock-only',
    GOOGLE_CLIENT_SECRET:'mock-only', SOR7ED_TEST_META_URL:metaUrl };
  for (const key of Object.keys(env)) if (key.startsWith('R2_') || key === 'REDIS_URL' || key === 'OPENAI_API_KEY' || key === 'VERCEL') delete env[key];
  const child = spawn(process.execPath, ['--import', './scripts/mock-meta-for-lean-tests.mjs', '--import','tsx','api/src/index.ts'], { env, stdio:['ignore','pipe','pipe'] });
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
  const second = await start(metaUrl);
  const statuses=[];
  for(let i=0;i<22;i++) statuses.push((await fetch((i%2 ? second : base)+'/api/auth/login',{redirect:'manual'})).status);
  assert.equal(statuses.filter(s=>s===302).length,20); assert.equal(statuses.filter(s=>s===429).length,2);
  await pool.query("update button_rate_limits set expires_at=now()-interval '1 second'");
  assert.equal((await fetch(base+'/api/auth/login',{redirect:'manual'})).status,302);
  console.log('PASS: shared Postgres rate limit spans two API processes and expires correctly');
} catch (error) {
  console.error(logs.join('').slice(-7000)); throw error;
} finally {
  for(const child of processes) child.kill('SIGTERM');
  await pool.end(); await new Promise(r=>mock.close(r));
}

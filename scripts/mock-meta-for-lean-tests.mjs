import { Resolver } from 'node:dns/promises';
import { createHmac } from 'node:crypto';
import pg from 'pg';
// Loaded only by the isolated integration runner, never by production entrypoints.
const database = new URL(process.env.SOR7ED_LEAN_TEST_DATABASE_URL ?? 'invalid:');
const target = new URL(process.env.SOR7ED_TEST_META_URL ?? 'invalid:');
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || !database.pathname.endsWith('_lean_tests') || target.hostname !== '127.0.0.1') {
  throw new Error('Meta test interception requires a disposable local database and server');
}
// Resolve only the disposable publisher's DNS proof. The production resolver
// stays unchanged; this preload is guarded above and never shipped by entrypoints.
Resolver.prototype.resolveTxt = async function(name) {
  if (name !== '_sor7ed-verify.example.com') throw new Error('External DNS is forbidden in lean integration tests');
  const client = new pg.Client({ connectionString: database.href });
  await client.connect();
  try {
    const { rows } = await client.query("select id from partners where api_key='lean-test-key'");
    if (!rows[0]) return [];
    const proof = createHmac('sha256', process.env.JWT_SECRET).update(`sor7ed-domain-v1:${rows[0].id}:example.com`).digest('hex');
    return [[`sor7ed-verification=${proof}`]];
  } finally { await client.end(); }
};
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
  if (url.hostname === 'graph.facebook.com' && url.pathname.endsWith('/messages')) {
    return realFetch(new URL('/messages', target), init);
  }
  if (url.hostname === 'www.planetsorted.com' && url.pathname === '/api/button/whatsapp') return realFetch(new URL('/relay-messages', target), init);
  throw new Error('External HTTP is forbidden in lean integration tests');
};

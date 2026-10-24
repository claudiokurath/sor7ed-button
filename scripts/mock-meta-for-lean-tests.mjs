// Loaded only by the isolated integration runner, never by production entrypoints.
const database = new URL(process.env.SOR7ED_LEAN_TEST_DATABASE_URL ?? 'invalid:');
const target = new URL(process.env.SOR7ED_TEST_META_URL ?? 'invalid:');
if (!['127.0.0.1', 'localhost'].includes(database.hostname)
  || !database.pathname.endsWith('_lean_tests') || target.hostname !== '127.0.0.1') {
  throw new Error('Meta test interception requires a disposable local database and server');
}
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
  if (url.hostname === 'graph.facebook.com' && url.pathname.endsWith('/messages')) {
    return realFetch(new URL('/messages', target), init);
  }
  if (url.hostname === 'www.planetsorted.com' && url.pathname === '/api/button/whatsapp') return realFetch(new URL('/relay-messages', target), init);
  throw new Error('External HTTP is forbidden in lean integration tests');
};

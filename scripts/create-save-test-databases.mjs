import pg from 'pg';

// Only disposable, local fixtures are permitted. Never reads DATABASE_URL.
const raw = process.env.SOR7ED_TEST_ADMIN_URL;
if (!raw) throw new Error('Set SOR7ED_TEST_ADMIN_URL for the local test Postgres instance.');
const url = new URL(raw);
if (!['localhost', '127.0.0.1'].includes(url.hostname)
    || url.username !== 'sor7ed_test' || url.pathname !== '/postgres') {
  throw new Error('Test setup requires localhost, user sor7ed_test and the postgres admin database.');
}
const client = new pg.Client({ connectionString: raw });
await client.connect();
try {
  for (const name of ['sor7ed_save_tests', 'sor7ed_connect_tests', 'sor7ed_api_tests', 'sor7ed_lean_tests']) {
    // Names are fixed, not supplied by a caller. These fixtures are disposable.
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`Prepared disposable database ${name}`);
  }
} finally {
  await client.end();
}

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required; refusing to run Prisma against any other database');
}

let parsed;
try {
  parsed = new URL(testDatabaseUrl);
} catch {
  throw new Error('TEST_DATABASE_URL is invalid');
}
const databaseName = parsed.pathname.replace(/^\/+/, '').toLowerCase();
if (
  !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
  !/(^|[_-])test($|[_-])/.test(databaseName)
) {
  throw new Error('Refusing Prisma command: TEST_DATABASE_URL must target a loopback database with a test-marked name');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
const prismaCli = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

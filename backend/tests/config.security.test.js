import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');

function runWithEnv(env) {
  return spawnSync(
    process.execPath,
    ['-e', "import('./src/config/index.js').then(() => console.log('ok')).catch((e) => { console.error(e.message); process.exit(1); })"],
    {
      cwd: backendRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    }
  );
}

describe('production config bootstrap', () => {
  it('refuses missing JWT secrets in production', () => {
    const r = runWithEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://kizumai_app:Str0ngUniqueDbPass99!@db:5432/kizumai',
      JWT_ACCESS_SECRET: '',
      JWT_REFRESH_SECRET: '',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /manquantes|JWT/i);
  });

  it('refuses weak JWT secrets', () => {
    const r = runWithEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://kizumai_app:Str0ngUniqueDbPass99!@db:5432/kizumai',
      JWT_ACCESS_SECRET: 'kizumai-kizumai-kizumai-kizumai-12',
      JWT_REFRESH_SECRET: 'another-secret-that-is-long-enough!!',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /faibles|JWT/i);
  });

  it('refuses default database password', () => {
    const r = runWithEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://kizumai:kizumai@db:5432/kizumai',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /mot de passe|DATABASE/i);
  });

  it('accepts strong production config', () => {
    const r = runWithEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgresql://kizumai_app:Str0ngUniqueDbPass99!@db:5432/kizumai',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
      REDIS_URL: 'redis://:Str0ngRedisPass99!@redis:6379',
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseCorsOrigins,
  validateAppUrl,
  validateRedisUrl,
  validateProductionEnvironment,
  isPlaceholderSecret,
} from '../src/config/envValidation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');

const STRONG_JWT_A = 'a'.repeat(40);
const STRONG_JWT_B = 'b'.repeat(40);
const STRONG_DB =
  'postgresql://kizumai_app:Str0ngUniqueDbPass99!@db.internal:5432/kizumai';
const STRONG_REDIS = 'redis://:Str0ngRedisPass99!@redis.internal:6379';

function runWithEnv(env) {
  return spawnSync(
    process.execPath,
    [
      '-e',
      "import('./src/config/index.js').then(() => console.log('ok')).catch((e) => { console.error(e.message); process.exit(1); })",
    ],
    {
      cwd: backendRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    }
  );
}

const prodBase = {
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://app.example.com',
  APP_URL: 'https://app.example.com',
  DATABASE_URL: STRONG_DB,
  JWT_ACCESS_SECRET: STRONG_JWT_A,
  JWT_REFRESH_SECRET: STRONG_JWT_B,
  REDIS_URL: STRONG_REDIS,
};

describe('CORS validation', () => {
  it('accepts single HTTPS origin in production', () => {
    const origin = parseCorsOrigins('https://app.example.com', { isProd: true });
    assert.equal(origin, 'https://app.example.com');
  });

  it('accepts multiple HTTPS origins in production', () => {
    const origins = parseCorsOrigins('https://a.example.com,https://b.example.com', {
      isProd: true,
    });
    assert.deepEqual(origins, ['https://a.example.com', 'https://b.example.com']);
  });

  it('rejects HTTP origin in production (http://evil.example)', () => {
    assert.throws(
      () => parseCorsOrigins('http://evil.example', { isProd: true }),
      /HTTPS requise/i
    );
  });

  it('rejects HTTP origin mixed in multi-origin list in production', () => {
    assert.throws(
      () => parseCorsOrigins('https://good.example.com,http://evil.example', { isProd: true }),
      /HTTPS requise/i
    );
  });

  it('rejects wildcard with credentials', () => {
    assert.throws(
      () => parseCorsOrigins('*', { isProd: false }),
      /wildcard/i
    );
  });

  it('rejects origin with path', () => {
    assert.throws(
      () => parseCorsOrigins('https://app.example.com/admin', { isProd: true }),
      /origin pure/i
    );
  });

  it('rejects origin with embedded credentials', () => {
    assert.throws(
      () => parseCorsOrigins('https://user:pass@evil.example.com', { isProd: true }),
      /identifiants/i
    );
  });

  it('rejects invalid origin format', () => {
    assert.throws(
      () => parseCorsOrigins('not-a-url', { isProd: true }),
      /invalide/i
    );
  });
});

describe('APP_URL validation', () => {
  it('accepts valid HTTPS origin in production', () => {
    const url = validateAppUrl('https://app.example.com', { isProd: true });
    assert.equal(url, 'https://app.example.com');
  });

  it('rejects HTTP APP_URL in production', () => {
    assert.throws(
      () => validateAppUrl('http://app.example.com', { isProd: true }),
      /HTTPS requise/i
    );
  });

  it('rejects localhost APP_URL in production', () => {
    assert.throws(
      () => validateAppUrl('https://localhost:5173', { isProd: true }),
      /localhost|réseau privé/i
    );
  });

  it('rejects APP_URL with credentials', () => {
    assert.throws(
      () => validateAppUrl('https://user:pass@app.example.com', { isProd: true }),
      /identifiants/i
    );
  });

  it('rejects APP_URL with path', () => {
    assert.throws(
      () => validateAppUrl('https://app.example.com/dashboard', { isProd: true }),
      /origin pure/i
    );
  });
});

describe('Redis URL validation', () => {
  it('rejects placeholder Redis password in production', () => {
    assert.throws(
      () => validateRedisUrl('redis://:CHANGE_ME_REDIS_PASSWORD@redis:6379', { isProd: true }),
      /placeholder|faible/i
    );
  });

  it('rejects weak redis password in production', () => {
    assert.throws(
      () => validateRedisUrl('redis://:redis@redis.internal:6379', { isProd: true }),
      /placeholder|faible/i
    );
  });

  it('rejects Redis without auth on public host', () => {
    assert.throws(
      () => validateRedisUrl('redis://public.redis.example.com:6379', { isProd: false }),
      /hors réseau interne/i
    );
  });

  it('accepts strong Redis password in production', () => {
    const url = validateRedisUrl(STRONG_REDIS, { isProd: true });
    assert.equal(url, STRONG_REDIS);
  });

  it('isPlaceholderSecret detects common placeholders', () => {
    assert.equal(isPlaceholderSecret('CHANGE_ME'), true);
    assert.equal(isPlaceholderSecret('password'), true);
    assert.equal(isPlaceholderSecret('kizumai'), true);
    assert.equal(isPlaceholderSecret('Str0ngRedisPass99!'), false);
  });
});

describe('production config bootstrap', () => {
  it('refuses missing JWT secrets in production', () => {
    const r = runWithEnv({
      ...prodBase,
      JWT_ACCESS_SECRET: '',
      JWT_REFRESH_SECRET: '',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /manquantes|JWT/i);
  });

  it('refuses weak JWT secrets', () => {
    const r = runWithEnv({
      ...prodBase,
      JWT_ACCESS_SECRET: 'kizumai-kizumai-kizumai-kizumai-12',
      JWT_REFRESH_SECRET: 'another-secret-that-is-long-enough!!',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /faibles|JWT/i);
  });

  it('refuses default database password', () => {
    const r = runWithEnv({
      ...prodBase,
      DATABASE_URL: 'postgresql://kizumai:kizumai@db:5432/kizumai',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /mot de passe|placeholder|DATABASE/i);
  });

  it('refuses http://evil.example CORS in production bootstrap', () => {
    const r = runWithEnv({
      ...prodBase,
      CORS_ORIGIN: 'http://evil.example',
      APP_URL: 'https://app.example.com',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /HTTPS/i);
  });

  it('refuses HTTP APP_URL in production bootstrap', () => {
    const r = runWithEnv({
      ...prodBase,
      APP_URL: 'http://app.example.com',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /APP_URL.*HTTPS/i);
  });

  it('refuses Redis placeholder in production bootstrap', () => {
    const r = runWithEnv({
      ...prodBase,
      REDIS_URL: 'redis://:CHANGE_ME_REDIS_PASSWORD@redis:6379',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /placeholder|faible|REDIS/i);
  });

  it('accepts strong production config', () => {
    const r = runWithEnv(prodBase);
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });

  it('validateProductionEnvironment rejects incomplete env', () => {
    assert.throws(
      () =>
        validateProductionEnvironment({
          NODE_ENV: 'production',
          CORS_ORIGIN: 'https://app.example.com',
        }),
      /manquantes/i
    );
  });
});

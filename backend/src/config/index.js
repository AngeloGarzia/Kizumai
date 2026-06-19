import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development';
const isProd = nodeEnv === 'production';

const envFile = isProd ? '.env.production' : '.env.development';
dotenv.config({ path: join(rootDir, envFile) });
dotenv.config({ path: join(rootDir, '.env') });

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'myrokay';
  const user = process.env.DB_USER || 'myrokay';
  const password = process.env.DB_PASSWORD || 'myrokay';

  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

const requiredInProduction = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGIN',
  'DATABASE_URL',
];

function validateConfig() {
  if (!isProd) return;

  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes en production : ${missing.join(', ')}`
    );
  }

  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_REFRESH_SECRET,
  ];
  for (const secret of secrets) {
    if (secret.length < 32) {
      throw new Error('Les secrets JWT doivent contenir au moins 32 caractères en production');
    }
  }
}

validateConfig();

const devSecrets = {
  access: 'dev-access-secret-change-in-production-32chars',
  refresh: 'dev-refresh-secret-change-in-production-32ch',
};

if (isDev && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  console.warn('[config] Secrets JWT par défaut utilisés — réservé au développement local');
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv,
  isDev,
  isProd,

  database: {
    url: buildDatabaseUrl(),
    ssl: isProd ? { rejectUnauthorized: true } : false,
    max: Number(process.env.DB_POOL_MAX) || 20,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || (isDev ? devSecrets.access : ''),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (isDev ? devSecrets.refresh : ''),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cookies: {
    accessName: 'myrokay_access',
    refreshName: 'myrokay_refresh',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    accessMaxAge: 15 * 60 * 1000,
    refreshMaxAge: 7 * 24 * 60 * 60 * 1000,
    refreshPath: '/api/auth',
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
};

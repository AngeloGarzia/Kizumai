import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseDurationMs } from '../utils/duration.js';
import {
  parseCorsOrigins,
  validateAppUrl,
  validateRedisUrl,
  validateProductionEnvironment,
} from './envValidation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development';
const isProd = nodeEnv === 'production';

const envFile = isProd ? '.env.production' : '.env.development';
dotenv.config({ path: join(rootDir, envFile) });
dotenv.config({ path: join(rootDir, '.env') });

const allowInsecureCors = process.env.ALLOW_INSECURE_CORS === 'true';
const allowInsecureRedis = process.env.ALLOW_INSECURE_REDIS === 'true';

function normalizeBasePath(raw) {
  const value = String(raw || '').trim();
  if (!value || value === '/') return '';
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/$/, '');
}

function joinUrlPath(base, segment) {
  const normalized = `${base || ''}${segment}`.replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function buildDatabaseUrl() {
  const user = process.env.POSTGRES_APP_USER?.trim();
  const password = process.env.POSTGRES_APP_PASSWORD?.trim();
  if (user && password) {
    const host = process.env.POSTGRES_HOST?.trim() || 'postgres';
    const port = process.env.POSTGRES_PORT?.trim() || '5432';
    const name = process.env.POSTGRES_DB?.trim() || 'kizumai';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (isProd) {
    throw new Error('DATABASE_URL est obligatoire en production');
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'kizumai';
  const devUser = process.env.DB_USER || 'kizumai';
  const devPassword = process.env.DB_PASSWORD || 'kizumai';

  return `postgresql://${devUser}:${devPassword}@${host}:${port}/${name}`;
}

function buildRedisUrl() {
  const password = process.env.REDIS_PASSWORD?.trim();
  if (password) {
    const host = process.env.REDIS_HOST?.trim() || 'redis';
    const port = process.env.REDIS_PORT?.trim() || '6379';
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return process.env.REDIS_URL?.trim() || '';
}

const databaseUrl = buildDatabaseUrl();
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

const redisUrlRaw = buildRedisUrl();
if (redisUrlRaw) {
  process.env.REDIS_URL = redisUrlRaw;
}

validateProductionEnvironment(process.env);

const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN, {
  isProd,
  allowInsecure: allowInsecureCors,
});

const appUrl = validateAppUrl(process.env.APP_URL, {
  isProd,
  allowInsecure: allowInsecureCors,
  fallback: typeof corsOrigin === 'string' ? corsOrigin : corsOrigin[0],
});

const appBasePath = normalizeBasePath(process.env.APP_BASE_PATH);
const publicAppUrl = `${appUrl}${appBasePath}`;
const cookieSecure =
  process.env.COOKIE_SECURE === 'true'
    ? true
    : process.env.COOKIE_SECURE === 'false'
      ? false
      : isProd;

const redisUrl = validateRedisUrl(redisUrlRaw, {
  isProd,
  allowInsecure: allowInsecureRedis,
});

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
    url: databaseUrl,
    ssl:
      process.env.DB_SSL === 'false'
        ? false
        : isProd
          ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
          : false,
    max: Number(process.env.DB_POOL_MAX) || 20,
  },

  cors: {
    origin: corsOrigin,
    credentials: true,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || (isDev ? devSecrets.access : ''),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (isDev ? devSecrets.refresh : ''),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'kizumai-api',
    audience: process.env.JWT_AUDIENCE || 'kizumai-web',
    algorithm: 'HS256',
    clockToleranceSec: Number(process.env.JWT_CLOCK_TOLERANCE_SEC) || 5,
  },

  cookies: {
    accessName: 'kizumai_access',
    refreshName: 'kizumai_refresh',
    csrfName: 'kizumai_csrf',
    httpOnly: true,
    secure: cookieSecure,
    sameSite: isProd ? 'strict' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    accessPath: appBasePath || '/',
    csrfPath: appBasePath || '/',
    accessMaxAge:
      parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN || '15m') ?? 15 * 60 * 1000,
    refreshMaxAge:
      parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d') ?? 7 * 24 * 60 * 60 * 1000,
    refreshPath: joinUrlPath(appBasePath, '/api/auth'),
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  },

  billing: {
    selfServePaidEnabled:
      process.env.ALLOW_SELF_SERVE_PAID != null
        ? process.env.ALLOW_SELF_SERVE_PAID === 'true'
        : isDev,
  },

  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'gemini',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gemini-3.6-flash',
  },

  appUrl,
  appBasePath,
  publicAppUrl,

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: process.env.STORAGE_LOCAL_DIR || 'uploads',
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES) || 20 * 1024 * 1024,
    maxDocumentsPerProject: Number(process.env.MAX_DOCS_PER_PROJECT) || 100,
    maxProjectStorageBytes:
      Number(process.env.MAX_PROJECT_STORAGE_BYTES) || 200 * 1024 * 1024,
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@kizumai.com',
    get enabled() {
      return Boolean(this.publicKey && this.privateKey);
    },
  },

  redis: {
    url: redisUrl,
  },

  queue: {
    get enabled() {
      if (process.env.QUEUE_ENABLED != null) {
        return process.env.QUEUE_ENABLED === 'true';
      }
      return Boolean(process.env.REDIS_URL);
    },
    prefix: process.env.QUEUE_PREFIX || 'kizumai',
    concurrency: Number(process.env.QUEUE_CONCURRENCY) || 5,
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'Kizumai <no-reply@kizumai.com>',
    get enabled() {
      return Boolean(this.host);
    },
  },

  memory: {
    decayCron: process.env.MEMORY_DECAY_CRON || '0 */6 * * *',
    snapshotCron: process.env.MEMORY_SNAPSHOT_CRON || '15 */6 * * *',
    archiveThreshold: Number(process.env.MEMORY_ARCHIVE_THRESHOLD) || 0.05,
    snapshotEventThreshold: Number(process.env.MEMORY_SNAPSHOT_EVENT_THRESHOLD) || 8,
    snapshotMaxAgeHours: Number(process.env.MEMORY_SNAPSHOT_MAX_AGE_HOURS) || 24,
    snapshotTopNodes: Number(process.env.MEMORY_SNAPSHOT_TOP_NODES) || 40,
    recallMaxChars: Number(process.env.MEMORY_RECALL_MAX_CHARS) || 4000,
    graphDepth: Number(process.env.MEMORY_GRAPH_DEPTH) || 2,
    recallNodeLimit: Number(process.env.MEMORY_RECALL_NODE_LIMIT) || 12,
    loginEvalMinIntervalHours: Number(process.env.MEMORY_LOGIN_EVAL_MIN_INTERVAL_HOURS) || 12,
  },
};

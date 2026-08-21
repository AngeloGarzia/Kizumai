import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseDurationMs } from '../utils/duration.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development';
const isProd = nodeEnv === 'production';

const envFile = isProd ? '.env.production' : '.env.development';
dotenv.config({ path: join(rootDir, envFile) });
dotenv.config({ path: join(rootDir, '.env') });

const WEAK_SECRET_PATTERNS = [
  /^change.?me/i,
  /^your.?secret/i,
  /^secret$/i,
  /^password$/i,
  /kizumai/i,
  /^test/i,
  /^dev-/i,
  /^example/i,
];

function isWeakSecret(value) {
  const s = String(value || '');
  if (s.length < 32) return true;
  return WEAK_SECRET_PATTERNS.some((re) => re.test(s));
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (isProd) {
    throw new Error('DATABASE_URL est obligatoire en production');
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'kizumai';
  const user = process.env.DB_USER || 'kizumai';
  const password = process.env.DB_PASSWORD || 'kizumai';

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

  const missing = requiredInProduction.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes en production : ${missing.join(', ')}`
    );
  }

  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;

  if (isWeakSecret(access) || isWeakSecret(refresh)) {
    throw new Error(
      'Secrets JWT trop faibles en production (min. 32 caractères, non triviaux)'
    );
  }
  if (access === refresh) {
    throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être distincts');
  }

  const cors = process.env.CORS_ORIGIN.trim();
  if (!/^https:\/\//i.test(cors) && process.env.ALLOW_INSECURE_CORS !== 'true') {
    throw new Error('CORS_ORIGIN doit être une origine https:// en production');
  }
  if (/localhost|127\.0\.0\.1/i.test(cors) && process.env.ALLOW_INSECURE_CORS !== 'true') {
    throw new Error('CORS_ORIGIN ne doit pas pointer vers localhost en production');
  }

  const dbUrl = process.env.DATABASE_URL;
  if (/:(kizumai|password|postgres|admin)@/i.test(dbUrl) || /:CHANGE_ME/i.test(dbUrl)) {
    throw new Error('DATABASE_URL semble utiliser un mot de passe par défaut — refuse le démarrage');
  }

  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL.trim();
    const withoutScheme = redisUrl.replace(/^rediss?:\/\//i, '');
    const hasAuth =
      withoutScheme.startsWith(':') || // redis://:password@host
      /^[^:/@]+:[^@]+@/.test(withoutScheme); // redis://user:pass@host
    if (!hasAuth && process.env.ALLOW_INSECURE_REDIS !== 'true') {
      throw new Error('REDIS_URL sans mot de passe interdit en production');
    }
  }

  if (process.env.ALLOW_SELF_SERVE_PAID === 'true') {
    console.warn('[config] ALLOW_SELF_SERVE_PAID=true en production');
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

function parseCorsOrigin(raw) {
  const value = raw || 'http://localhost:5173';
  if (value.includes(',')) {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv,
  isDev,
  isProd,

  database: {
    url: buildDatabaseUrl(),
    ssl:
      process.env.DB_SSL === 'false'
        ? false
        : isProd
          ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
          : false,
    max: Number(process.env.DB_POOL_MAX) || 20,
  },

  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
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
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    accessMaxAge:
      parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN || '15m') ?? 15 * 60 * 1000,
    refreshMaxAge:
      parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d') ?? 7 * 24 * 60 * 60 * 1000,
    refreshPath: '/api/auth',
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
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gemini-2.0-flash',
  },

  appUrl: process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',

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
    url: process.env.REDIS_URL || '',
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
  },
};

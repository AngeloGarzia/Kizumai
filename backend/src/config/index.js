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
    accessName: 'kizumai_access',
    refreshName: 'kizumai_refresh',
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

  billing: {
    // Autorise l'obtention d'un compte payant sans passerelle de paiement.
    // Par défaut activé en développement uniquement ; désactivé en production
    // tant qu'aucun fournisseur de paiement n'est branché.
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
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES) || 25 * 1024 * 1024,
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
    // File d'attente BullMQ activée dès qu'une URL Redis est fournie.
    // Peut être forcée via QUEUE_ENABLED=true/false.
    get enabled() {
      if (process.env.QUEUE_ENABLED != null) {
        return process.env.QUEUE_ENABLED === 'true';
      }
      return Boolean(process.env.REDIS_URL);
    },
    prefix: process.env.QUEUE_PREFIX || 'kizumai',
    // Nombre de jobs traités en parallèle par le worker.
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
};

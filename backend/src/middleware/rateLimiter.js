import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const common = {
  standardHeaders: true,
  legacyHeaders: false,
};

let redisClientPromise = null;

export async function getRateLimitRedis() {
  if (!config.redis?.url) return null;
  if (redisClientPromise) return redisClientPromise;
  redisClientPromise = (async () => {
    try {
      const { getRedisConnection } = await import('../queue/connection.js');
      const shared = getRedisConnection();
      if (shared) return shared;
      const IORedis = (await import('ioredis')).default;
      const client = new IORedis(config.redis.url, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      await client.connect();
      return client;
    } catch (err) {
      console.warn(`[rate-limit] Redis indisponible : ${err.message}`);
      return null;
    }
  })();
  return redisClientPromise;
}

function buildLimiter({ windowMs, max, message, keyGenerator }) {
  return rateLimit({
    ...common,
    windowMs,
    max,
    message: { success: false, message },
    keyGenerator:
      keyGenerator ||
      ((req) => {
        const uid = req.user?.id;
        return uid ? `u:${uid}` : req.ip || 'unknown';
      }),
  });
}

/**
 * Quota Redis additionnel (multi-instance).
 * failClosed=true (routes IA) : 503 si Redis requis mais indisponible.
 */
export function redisQuotaMiddleware({ prefix, windowMs, max, failClosed = false }) {
  return async (req, res, next) => {
    try {
      const client = await getRateLimitRedis();
      if (!client) {
        if (failClosed && config.redis?.url && config.isProd) {
          return res.status(503).json({
            success: false,
            message: 'Service temporairement indisponible (quota)',
          });
        }
        return next();
      }
      const uid = req.user?.id;
      const id = uid ? `u:${uid}` : req.ip || 'unknown';
      const key = `rlx:${prefix}:${id}`;
      const hits = await client.incr(key);
      if (hits === 1) await client.pexpire(key, windowMs);
      if (hits > max) {
        return res.status(429).json({
          success: false,
          message: 'Trop de requêtes (quota distribué), réessayez plus tard',
        });
      }
      return next();
    } catch {
      if (failClosed && config.isProd) {
        return res.status(503).json({
          success: false,
          message: 'Service temporairement indisponible (quota)',
        });
      }
      return next();
    }
  };
}

export const loginRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
  prefix: 'login',
  keyGenerator: (req) => req.ip || 'unknown',
});

export const registerRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Trop d’inscriptions depuis cette adresse, réessayez plus tard',
  prefix: 'register',
  keyGenerator: (req) => req.ip || 'unknown',
});

export const refreshRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Trop de renouvellements de session, réessayez dans 15 minutes',
  prefix: 'refresh',
});

export const authActionRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Trop de tentatives, réessayez dans 15 minutes',
  prefix: 'auth-action',
});

export const aiRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_MAX) || 30,
  message: 'Trop de recherches IA, réessayez dans 15 minutes',
  prefix: 'ai',
});

export const aiAnonymousRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AI_ANON_RATE_MAX) || 3,
  message: 'Trop de recherches IA anonymes, connectez-vous ou réessayez plus tard',
  keyGenerator: (req) => req.ip || 'unknown',
});

export const documentScanRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_SCAN_RATE_MAX) || 8,
  message: 'Trop de scans de documents, réessayez dans 15 minutes',
  prefix: 'ai-scan',
});

/** Quota Redis empilé sur les routes IA (si REDIS_URL). Fail-closed en prod. */
export const aiRedisQuota = redisQuotaMiddleware({
  prefix: 'ai',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_MAX) || 30,
  failClosed: true,
});

export const aiAnonRedisQuota = redisQuotaMiddleware({
  prefix: 'ai-anon',
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AI_ANON_RATE_MAX) || 3,
  failClosed: true,
});

export const scanRedisQuota = redisQuotaMiddleware({
  prefix: 'ai-scan',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_SCAN_RATE_MAX) || 8,
  failClosed: true,
});

export const authRateLimiter = loginRateLimiter;

export const uploadRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_MAX) || 25,
  message: 'Trop de téléversements, réessayez dans 15 minutes',
  prefix: 'upload',
});

export const previewTextRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PREVIEW_TEXT_RATE_MAX) || 40,
  message: 'Trop de demandes d’aperçu texte, réessayez plus tard',
  prefix: 'preview-text',
});

export const adminRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ADMIN_RATE_MAX) || 120,
  message: 'Trop de requêtes admin, réessayez plus tard',
  prefix: 'admin',
});

/** Quotas Redis distribués (empilés sur les limiters in-memory — défense en profondeur). */
export const loginRedisQuota = redisQuotaMiddleware({
  prefix: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  failClosed: true,
});

export const registerRedisQuota = redisQuotaMiddleware({
  prefix: 'register',
  windowMs: 60 * 60 * 1000,
  max: 10,
  failClosed: true,
});

export const refreshRedisQuota = redisQuotaMiddleware({
  prefix: 'refresh',
  windowMs: 15 * 60 * 1000,
  max: 60,
  failClosed: true,
});

export const authActionRedisQuota = redisQuotaMiddleware({
  prefix: 'auth-action',
  windowMs: 15 * 60 * 1000,
  max: 20,
  failClosed: true,
});

export const uploadRedisQuota = redisQuotaMiddleware({
  prefix: 'upload',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_MAX) || 25,
  failClosed: true,
});

export const previewTextRedisQuota = redisQuotaMiddleware({
  prefix: 'preview-text',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PREVIEW_TEXT_RATE_MAX) || 40,
  failClosed: true,
});

export const adminRedisQuota = redisQuotaMiddleware({
  prefix: 'admin',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ADMIN_RATE_MAX) || 120,
  failClosed: true,
});

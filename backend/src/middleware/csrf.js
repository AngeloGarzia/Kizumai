import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins() {
  return String(config.cors.origin || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function assertAllowedOrigin(req) {
  const allowed = allowedOrigins();
  if (!allowed.length) return;

  const origin = req.get('origin');
  if (origin) {
    if (!allowed.includes(origin)) {
      throw new AppError('Origine non autorisée', 403);
    }
    return;
  }

  const referer = req.get('referer');
  if (referer) {
    const refOrigin = originFromReferer(referer);
    if (!refOrigin || !allowed.includes(refOrigin)) {
      throw new AppError('Origine non autorisée', 403);
    }
    return;
  }

  if (config.isProd) {
    throw new AppError('Origine manquante', 403);
  }
}

/** Génère et pose le cookie CSRF (lisible JS — double-submit). */
export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(config.cookies.csrfName, token, {
    httpOnly: false,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    domain: config.cookies.domain,
    path: '/',
    maxAge: config.cookies.refreshMaxAge,
  });
  return token;
}

export function clearCsrfCookie(res) {
  res.clearCookie(config.cookies.csrfName, {
    httpOnly: false,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    domain: config.cookies.domain,
    path: '/',
  });
}

/**
 * CSRF pour API cookie-based :
 * 1) Origin/Referer sur les méthodes non sûres
 * 2) Double-submit (cookie `kizumai_csrf` + header `X-CSRF-Token`)
 *    sauf login/register sans session (bootstrap)
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  try {
    assertAllowedOrigin(req);

    const path = req.path || '';
    const isCredentialBootstrap =
      path.endsWith('/auth/login') || path.endsWith('/auth/register');
    const hasAuthCookie = Boolean(
      req.cookies?.[config.cookies.accessName] ||
        req.cookies?.[config.cookies.refreshName]
    );

    if (isCredentialBootstrap && !hasAuthCookie) {
      return next();
    }

    const csrfCookie = req.cookies?.[config.cookies.csrfName];
    const csrfHeader = req.get('x-csrf-token');
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new AppError('Jeton CSRF invalide ou manquant', 403);
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

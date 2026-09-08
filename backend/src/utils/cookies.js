import { config } from '../config/index.js';
import { clearCsrfCookie, issueCsrfToken } from '../middleware/csrf.js';

const baseOptions = () => ({
  httpOnly: config.cookies.httpOnly,
  secure: config.cookies.secure,
  sameSite: config.cookies.sameSite,
  domain: config.cookies.domain,
});

/**
 * @param {import('express').Response} res
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {{ rememberMe?: boolean, refreshMaxAge?: number|null }} [opts]
 *   rememberMe=true  → cookie persistant long (30j)
 *   rememberMe=false → cookie de session (fermeture navigateur)
 *   omit            → comportement historique (JWT_REFRESH_EXPIRES_IN)
 */
export const setAuthCookies = (res, accessToken, refreshToken, opts = {}) => {
  const { rememberMe, refreshMaxAge: overrideMaxAge } = opts;

  let refreshMaxAge;
  if (overrideMaxAge !== undefined) {
    refreshMaxAge = overrideMaxAge;
  } else if (rememberMe === true) {
    refreshMaxAge = config.cookies.refreshMaxAgeRemember;
  } else if (rememberMe === false) {
    refreshMaxAge = null;
  } else {
    refreshMaxAge = config.cookies.refreshMaxAge;
  }

  res.cookie(config.cookies.accessName, accessToken, {
    ...baseOptions(),
    path: config.cookies.accessPath,
    maxAge: config.cookies.accessMaxAge,
  });

  const refreshOpts = {
    ...baseOptions(),
    path: config.cookies.refreshPath,
  };
  if (refreshMaxAge != null && refreshMaxAge > 0) {
    refreshOpts.maxAge = refreshMaxAge;
  }
  res.cookie(config.cookies.refreshName, refreshToken, refreshOpts);

  issueCsrfToken(res);
};

export const clearAuthCookies = (res) => {
  const options = baseOptions();

  res.clearCookie(config.cookies.accessName, { ...options, path: config.cookies.accessPath });
  res.clearCookie(config.cookies.refreshName, {
    ...options,
    path: config.cookies.refreshPath,
  });
  clearCsrfCookie(res);
};

export const getAccessToken = (req) => req.cookies?.[config.cookies.accessName];
export const getRefreshToken = (req) => req.cookies?.[config.cookies.refreshName];

/** TTL initiale ≤ 36h → login sans « Se souvenir de moi ». */
export function isSessionRefreshToken(stored) {
  if (!stored?.expiresAt || !stored?.createdAt) return false;
  const ttlMs = new Date(stored.expiresAt).getTime() - new Date(stored.createdAt).getTime();
  return ttlMs > 0 && ttlMs <= 36 * 60 * 60 * 1000;
}

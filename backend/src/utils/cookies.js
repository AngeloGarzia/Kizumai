import { config } from '../config/index.js';
import { clearCsrfCookie, issueCsrfToken } from '../middleware/csrf.js';

const baseOptions = () => ({
  httpOnly: config.cookies.httpOnly,
  secure: config.cookies.secure,
  sameSite: config.cookies.sameSite,
  domain: config.cookies.domain,
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(config.cookies.accessName, accessToken, {
    ...baseOptions(),
    path: '/',
    maxAge: config.cookies.accessMaxAge,
  });

  res.cookie(config.cookies.refreshName, refreshToken, {
    ...baseOptions(),
    path: config.cookies.refreshPath,
    maxAge: config.cookies.refreshMaxAge,
  });

  // CSRF double-submit (non-HttpOnly) — renouvelé à chaque émission de session
  issueCsrfToken(res);
};

export const clearAuthCookies = (res) => {
  const options = baseOptions();

  res.clearCookie(config.cookies.accessName, { ...options, path: '/' });
  res.clearCookie(config.cookies.refreshName, {
    ...options,
    path: config.cookies.refreshPath,
  });
  clearCsrfCookie(res);
};

export const getAccessToken = (req) => req.cookies?.[config.cookies.accessName];
export const getRefreshToken = (req) => req.cookies?.[config.cookies.refreshName];

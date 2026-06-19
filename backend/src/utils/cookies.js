import { config } from '../config/index.js';

const baseOptions = () => ({
  httpOnly: config.cookies.httpOnly,
  secure: config.cookies.secure,
  sameSite: config.cookies.sameSite,
  domain: config.cookies.domain,
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(config.cookies.accessName, accessToken, {
    ...baseOptions(),
    maxAge: config.cookies.accessMaxAge,
  });

  res.cookie(config.cookies.refreshName, refreshToken, {
    ...baseOptions(),
    path: config.cookies.refreshPath,
    maxAge: config.cookies.refreshMaxAge,
  });
};

export const clearAuthCookies = (res) => {
  const options = baseOptions();

  res.clearCookie(config.cookies.accessName, options);
  res.clearCookie(config.cookies.refreshName, {
    ...options,
    path: config.cookies.refreshPath,
  });
};

export const getAccessToken = (req) => req.cookies?.[config.cookies.accessName];
export const getRefreshToken = (req) => req.cookies?.[config.cookies.refreshName];

import { asyncHandler } from '../utils/AppError.js';
import { getAccessToken } from '../utils/cookies.js';

export function createAuthenticate({ authService }) {
  return asyncHandler(async (req, res, next) => {
    const accessToken = getAccessToken(req);
    req.user = await authService.getAuthenticatedUser(accessToken);
    next();
  });
}

export function createOptionalAuth({ authService }) {
  return asyncHandler(async (req, res, next) => {
    const accessToken = getAccessToken(req);
    if (accessToken) {
      try {
        req.user = await authService.getAuthenticatedUser(accessToken);
      } catch {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  });
}

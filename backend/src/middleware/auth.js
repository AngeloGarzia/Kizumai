import { AuthService } from '../services/AuthService.js';
import { asyncHandler } from '../utils/AppError.js';
import { getAccessToken } from '../utils/cookies.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const accessToken = getAccessToken(req);
  req.user = await AuthService.getAuthenticatedUser(accessToken);
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const accessToken = getAccessToken(req);
  if (accessToken) {
    try {
      req.user = await AuthService.getAuthenticatedUser(accessToken);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

import { AuthService } from '../services/AuthService.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { asyncHandler } from '../utils/AppError.js';
import { setAuthCookies, clearAuthCookies, getRefreshToken, getAccessToken } from '../utils/cookies.js';
import { successResponse } from '../utils/response.js';

export const AuthController = {
  register: asyncHandler(async (req, res) => {
    const { user, tokens } = await AuthService.register(req.body);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    await ConnectionService.log(req, { userId: user.id, email: user.email, action: 'register' });
    successResponse(res, { user }, 201);
  }),

  login: asyncHandler(async (req, res) => {
    const { user, tokens } = await AuthService.login(req.body);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    await ConnectionService.log(req, { userId: user.id, email: user.email, action: 'login' });
    successResponse(res, { user });
  }),

  refresh: asyncHandler(async (req, res) => {
    const refreshToken = getRefreshToken(req);
    const { user, tokens } = await AuthService.refresh(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    await ConnectionService.log(req, { userId: user.id, email: user.email, action: 'refresh' });
    successResponse(res, { user });
  }),

  logout: asyncHandler(async (req, res) => {
    let user = null;
    try {
      const accessToken = getAccessToken(req);
      if (accessToken) {
        user = await AuthService.getAuthenticatedUser(accessToken);
        await AuthService.logout(user.id);
      }
    } catch {
      // Révoquer la session si possible, sinon on efface quand même les cookies
    }
    if (user) {
      await ConnectionService.log(req, { userId: user.id, email: user.email, action: 'logout' });
    }
    clearAuthCookies(res);
    successResponse(res, { message: 'Déconnexion réussie' });
  }),

  me: asyncHandler(async (req, res) => {
    successResponse(res, { user: req.user });
  }),
};

import { AuthResponseDto, LoginRequestDto, RegisterRequestDto } from '../dto/auth.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshToken,
  getAccessToken,
} from '../utils/cookies.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { successResponse } from '../utils/response.js';

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ip: req.ip || null,
  };
}

export function createAuthController({ authService, connectionService }) {
  return {
    csrf: asyncHandler(async (req, res) => {
      const token = issueCsrfToken(res);
      successResponse(res, { csrfToken: token });
    }),

    register: asyncHandler(async (req, res) => {
      const dto = RegisterRequestDto.from(req.body);
      const { user, tokens } = await authService.register(dto, requestMeta(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      await connectionService.log(req, { userId: user.id, email: user.email, action: 'register' });
      successResponse(res, AuthResponseDto.fromUser(user), 201);
    }),

    login: asyncHandler(async (req, res) => {
      const dto = LoginRequestDto.from(req.body);
      const { user, tokens } = await authService.login(dto, requestMeta(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      await connectionService.log(req, { userId: user.id, email: user.email, action: 'login' });
      successResponse(res, AuthResponseDto.fromUser(user));
    }),

    refresh: asyncHandler(async (req, res) => {
      const refreshToken = getRefreshToken(req);
      const { user, tokens } = await authService.refresh(refreshToken, requestMeta(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      await connectionService.log(req, { userId: user.id, email: user.email, action: 'refresh' });
      successResponse(res, AuthResponseDto.fromUser(user));
    }),

    logout: asyncHandler(async (req, res) => {
      let user = null;
      const refreshToken = getRefreshToken(req);

      try {
        const accessToken = getAccessToken(req);
        if (accessToken) {
          user = await authService.getAuthenticatedUser(accessToken);
        }
      } catch {
        // Access expiré : révocation via refresh opaque.
      }

      await authService.logout({
        userId: user?.id ?? null,
        refreshToken,
      });

      if (user) {
        await connectionService.log(req, { userId: user.id, email: user.email, action: 'logout' });
      }

      clearAuthCookies(res);
      successResponse(res, { message: 'Déconnexion réussie' });
    }),

    logoutAll: asyncHandler(async (req, res) => {
      await authService.logoutAll(req.user.id);
      await connectionService.log(req, {
        userId: req.user.id,
        email: req.user.email,
        action: 'logout_all',
      });
      clearAuthCookies(res);
      successResponse(res, { message: 'Toutes les sessions ont été révoquées' });
    }),

    me: asyncHandler(async (req, res) => {
      successResponse(res, AuthResponseDto.fromUser(req.user));
    }),

    billingConfig: asyncHandler(async (req, res) => {
      successResponse(res, await authService.getBillingConfig());
    }),

    upgrade: asyncHandler(async (req, res) => {
      const user = await authService.upgradeToPaid(req.user.id);
      successResponse(res, AuthResponseDto.fromUser(user));
    }),
  };
}

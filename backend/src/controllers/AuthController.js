import { AuthResponseDto, LoginRequestDto, RegisterRequestDto } from '../dto/auth.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshToken,
  getAccessToken,
  isSessionRefreshToken,
} from '../utils/cookies.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { successResponse } from '../utils/response.js';

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ip: req.ip || null,
  };
}

function cookieOptsFromTokens(tokens, sessionMeta = null) {
  if (tokens?.sessionOnly) return { rememberMe: false };
  if (tokens?.rememberMe) return { rememberMe: true };
  if (sessionMeta && isSessionRefreshToken(sessionMeta)) {
    return { rememberMe: false };
  }
  if (sessionMeta?.expiresAt) {
    const remaining = new Date(sessionMeta.expiresAt).getTime() - Date.now();
    if (remaining > 0) return { refreshMaxAge: remaining };
  }
  return {};
}

export function createAuthController({
  authService,
  connectionService,
  projectMemoryLoginEvalService = null,
}) {
  return {
    csrf: asyncHandler(async (req, res) => {
      const token = issueCsrfToken(res);
      successResponse(res, { csrfToken: token });
    }),

    register: asyncHandler(async (req, res) => {
      const dto = RegisterRequestDto.from(req.body);
      const result = await authService.register(dto);

      if (result.pendingVerification) {
        await connectionService.log(req, {
          userId: null,
          email: result.email,
          action: 'register_pending',
        });
        successResponse(
          res,
          {
            pendingVerification: true,
            email: result.email,
            message:
              'Compte créé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.',
          },
          201
        );
        return;
      }

      // Chemin legacy (ne devrait plus arriver) : session immédiate.
      setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
      await connectionService.log(req, {
        userId: result.user.id,
        email: result.user.email,
        action: 'register',
      });
      successResponse(res, AuthResponseDto.fromUser(result.user), 201);
    }),

    confirmEmail: asyncHandler(async (req, res) => {
      const token = String(req.body?.token || '').trim();
      const { user, tokens } = await authService.confirmEmail(token, requestMeta(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken, cookieOptsFromTokens(tokens));
      await connectionService.log(req, {
        userId: user.id,
        email: user.email,
        action: 'confirm_email',
      });
      successResponse(res, AuthResponseDto.fromUser(user));
    }),

    resendConfirmation: asyncHandler(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const result = await authService.resendConfirmation({ email });
      successResponse(res, result);
    }),

    login: asyncHandler(async (req, res) => {
      const dto = LoginRequestDto.from(req.body);
      const { user, tokens } = await authService.login(dto, requestMeta(req));
      setAuthCookies(
        res,
        tokens.accessToken,
        tokens.refreshToken,
        cookieOptsFromTokens(tokens)
      );
      await connectionService.log(req, { userId: user.id, email: user.email, action: 'login' });
      projectMemoryLoginEvalService?.scheduleAfterLogin(user);
      successResponse(res, AuthResponseDto.fromUser(user));
    }),

    refresh: asyncHandler(async (req, res) => {
      const refreshToken = getRefreshToken(req);
      const { user, tokens, sessionMeta } = await authService.refresh(
        refreshToken,
        requestMeta(req)
      );
      setAuthCookies(
        res,
        tokens.accessToken,
        tokens.refreshToken,
        cookieOptsFromTokens(tokens, sessionMeta)
      );
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

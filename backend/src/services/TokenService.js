import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

export const TokenService = {
  generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn }
    );
  },

  generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id, version: user.refreshTokenVersion },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  },

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.accessSecret);
    } catch {
      throw new AppError('Session expirée, veuillez vous reconnecter', 401);
    }
  },

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.jwt.refreshSecret);
    } catch {
      throw new AppError('Refresh token invalide ou expiré', 401);
    }
  },
};

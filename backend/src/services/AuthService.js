import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { UserModel } from '../models/UserModel.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { TokenService } from './TokenService.js';

export const AuthService = {
  async register({ name, email, password }) {
    if (!name || !email || !password) {
      throw new AppError('Le nom, l\'email et le mot de passe sont requis', 400);
    }

    if (password.length < 8) {
      throw new AppError('Le mot de passe doit contenir au moins 8 caractères', 400);
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      throw new AppError('Cet email est déjà utilisé', 409);
    }

    const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const user = await UserModel.create({ name, email, password: hashedPassword });

    const tokens = this.generateTokenPair(user);
    return { user: sanitizeUser(user), tokens };
  },

  async login({ email, password }) {
    if (!email || !password) {
      throw new AppError('L\'email et le mot de passe sont requis', 400);
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new AppError('Identifiants invalides', 401);
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new AppError('Identifiants invalides', 401);
    }

    const tokens = this.generateTokenPair(user);
    return { user: sanitizeUser(user), tokens };
  },

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token manquant', 401);
    }

    const payload = TokenService.verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.userId);

    if (!user || user.refreshTokenVersion !== payload.version) {
      throw new AppError('Session révoquée, veuillez vous reconnecter', 401);
    }

    const tokens = this.generateTokenPair(user);
    return { user: sanitizeUser(user), tokens };
  },

  async logout(userId) {
    await UserModel.incrementRefreshTokenVersion(userId);
  },

  async getAuthenticatedUser(accessToken) {
    if (!accessToken) {
      throw new AppError('Non authentifié', 401);
    }

    const payload = TokenService.verifyAccessToken(accessToken);
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      throw new AppError('Utilisateur introuvable', 401);
    }

    return sanitizeUser(user);
  },

  generateTokenPair(user) {
    return {
      accessToken: TokenService.generateAccessToken(user),
      refreshToken: TokenService.generateRefreshToken(user),
    };
  },
};

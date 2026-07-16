import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { PLANS } from '../constants/plans.js';
import { UserModel } from '../models/UserModel.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { TokenService } from './TokenService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthService = {
  async register({ name, email, password, plan = PLANS.FREE }) {
    if (!name || !email || !password) {
      throw new AppError('Le nom, l\'email et le mot de passe sont requis', 400);
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      throw new AppError('Le nom doit contenir entre 2 et 120 caractères', 400);
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new AppError('Adresse email invalide', 400);
    }

    if (password.length < 8) {
      throw new AppError('Le mot de passe doit contenir au moins 8 caractères', 400);
    }

    if (![PLANS.FREE, PLANS.PAID].includes(plan)) {
      throw new AppError('Formule de compte invalide', 400);
    }

    // Le serveur ne fait jamais confiance au plan fourni par le client :
    // un compte payant n'est accordé que si le self-service est activé.
    const grantedPlan =
      plan === PLANS.PAID && !config.billing.selfServePaidEnabled ? PLANS.FREE : plan;

    const existing = await UserModel.findByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('Cet email est déjà utilisé', 409);
    }

    const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const user = await UserModel.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      plan: grantedPlan,
    });

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

  async upgradeToPaid(userId) {
    if (!config.billing.selfServePaidEnabled) {
      throw new AppError('Un paiement est requis pour activer un compte payant', 402);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }
    if (user.plan === PLANS.PAID || user.role === 'admin') {
      return sanitizeUser(user);
    }

    const updated = await UserModel.updatePlan(userId, PLANS.PAID);
    return sanitizeUser(updated);
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

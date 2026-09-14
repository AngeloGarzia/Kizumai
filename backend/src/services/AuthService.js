import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { PLANS } from '../constants/plans.js';
import pool from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { assertPasswordStrength } from '../utils/passwordPolicy.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { TransactionalMail } from './TransactionalMail.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TTL_HOURS = 48;

/** Hash bcrypt fixe pour égaliser le timing login (email inconnu). */
const DUMMY_PASSWORD_HASH =
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oQ9zqK8Y5K2i';

function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function buildConfirmUrl(rawToken) {
  const base = String(config.publicAppUrl || config.appUrl || '').replace(/\/$/, '');
  return `${base}/confirm-email?token=${encodeURIComponent(rawToken)}`;
}

function isEmailVerified(user) {
  return Boolean(user?.emailVerifiedAt);
}

export function createAuthService({
  userRepository,
  refreshTokenRepository,
  tokenService,
  settingsService = null,
}) {
  async function issueTokenPair(
    user,
    { familyId = null, userAgent = null, ip = null, rememberMe = null } = {}
  ) {
    const accessToken = tokenService.generateAccessToken(user);
    const opaque = familyId
      ? tokenService.rotateOpaqueRefreshToken(familyId)
      : tokenService.createOpaqueRefreshToken();

    const mode =
      rememberMe === true ? 'remember' : rememberMe === false ? 'session' : 'default';

    await refreshTokenRepository.create({
      userId: user.id,
      tokenHash: opaque.tokenHash,
      familyId: opaque.familyId,
      expiresAt: tokenService.refreshExpiresAt(mode),
      userAgent,
      ip,
    });

    return {
      accessToken,
      refreshToken: opaque.token,
      rememberMe: rememberMe === true,
      sessionOnly: rememberMe === false,
    };
  }

  async function issueEmailVerification(user) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);

    await userRepository.setEmailVerificationToken(user.id, { tokenHash, expiresAt });

    // L’envoi SMTP ne doit jamais bloquer / faire planter l’inscription (502 nginx).
    const confirmUrl = buildConfirmUrl(rawToken);
    void (async () => {
      try {
        const mailResult = await TransactionalMail.sendAccountConfirmationEmail({
          to: user.email,
          name: user.name,
          confirmUrl,
          expiresHours: VERIFY_TTL_HOURS,
        });

        if (!mailResult?.ok && !mailResult?.skipped) {
          console.warn(
            `[auth] Échec envoi email de confirmation à ${user.email} : ${mailResult?.error || 'inconnu'}`
          );
        }

        if (mailResult?.skipped) {
          console.log(`[auth] Lien de confirmation (dev) : ${confirmUrl}`);
        }
      } catch (err) {
        console.warn(
          `[auth] Exception envoi email de confirmation à ${user.email} : ${err.message || err}`
        );
      }
    })();

    return { expiresAt };
  }

  return {
    async register({ name, email, password }) {
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

      assertPasswordStrength(password);

      // Plan toujours free — le client ne peut pas s'auto-attribuer paid.
      const existing = await userRepository.findByEmail(normalizedEmail);
      if (existing) {
        // Anti-énumération : coût bcrypt + message générique (pas de 409).
        await bcrypt.hash(password, config.bcrypt.saltRounds);
        if (!isEmailVerified(existing)) {
          // Compte non confirmé : renvoyer un mail plutôt que révéler l'existence.
          await issueEmailVerification(existing);
        }
        return {
          pendingVerification: true,
          email: normalizedEmail,
        };
      }

      const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
      const user = await userRepository.create({
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        plan: PLANS.FREE,
        emailVerifiedAt: null,
      });

      await issueEmailVerification(user);

      // Pas de session tant que l'email n'est pas confirmé.
      return {
        pendingVerification: true,
        email: normalizedEmail,
      };
    },

    async confirmEmail(rawToken, meta = {}) {
      const token = String(rawToken || '').trim();
      if (!token || token.length < 20) {
        throw new AppError('Lien de confirmation invalide ou expiré', 400);
      }

      const tokenHash = hashVerificationToken(token);
      const user = await userRepository.findByEmailVerificationTokenHash(tokenHash);
      if (!user) {
        throw new AppError('Lien de confirmation invalide ou expiré', 400);
      }

      if (
        user.emailVerificationExpiresAt &&
        new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()
      ) {
        throw new AppError('Lien de confirmation expiré. Demandez un nouvel email.', 400);
      }

      const verified = await userRepository.markEmailVerified(user.id);
      const tokens = await issueTokenPair(verified, meta);
      return { user: sanitizeUser(verified), tokens };
    },

    async resendConfirmation({ email }) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new AppError('Adresse email invalide', 400);
      }

      const user = await userRepository.findByEmail(normalizedEmail);
      // Anti-énumération : même réponse que le succès.
      if (user && !isEmailVerified(user)) {
        await issueEmailVerification(user);
      }

      return {
        pendingVerification: true,
        email: normalizedEmail,
        message: 'Si un compte est en attente, un email de confirmation a été renvoyé.',
      };
    },

    /** Infos publiques de facturation (aucune donnée sensible). */
    async getBillingConfig() {
      if (settingsService) {
        const flags = await settingsService.getFeatureFlags();
        return { selfServePaidEnabled: Boolean(flags.selfServePaidEnabled) };
      }
      return {
        selfServePaidEnabled: Boolean(config.billing.selfServePaidEnabled),
      };
    },

    async login({ email, password, rememberMe = false }, meta = {}) {
      if (!email || !password) {
        throw new AppError('L\'email et le mot de passe sont requis', 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await userRepository.findByEmail(normalizedEmail);

      // Toujours bcrypt.compare pour limiter l'oracle de timing.
      const hash = user?.password || DUMMY_PASSWORD_HASH;
      const isValid = await bcrypt.compare(password, hash);
      if (!user || !isValid) {
        throw new AppError('Identifiants invalides', 401);
      }

      if (!isEmailVerified(user)) {
        throw new AppError(
          'Confirmez votre email avant de vous connecter. Vérifiez votre boîte de réception.',
          403
        );
      }

      const tokens = await issueTokenPair(user, { ...meta, rememberMe: Boolean(rememberMe) });
      return { user: sanitizeUser(user), tokens };
    },

    /**
     * Rotation du refresh opaque :
     * - invalide l'ancien token
     * - émet un nouveau token dans la même famille
     * - réutilisation d'un token déjà révoqué → révocation de toute la famille
     */
    async refresh(refreshToken, meta = {}) {
      if (!refreshToken) {
        throw new AppError('Refresh token manquant', 401);
      }

      const tokenHash = tokenService.hashRefreshToken(refreshToken);
      const client = await pool.connect();
      let finished = false;

      try {
        await client.query('BEGIN');

        const stored = await refreshTokenRepository.findByHashForUpdate(tokenHash, client);
        if (!stored) {
          await client.query('ROLLBACK');
          finished = true;
          throw new AppError('Refresh token invalide ou expiré', 401);
        }

        if (stored.revokedAt) {
          await refreshTokenRepository.revokeFamily(stored.familyId, client);
          // Invalide aussi les access JWT encore valides pour cet utilisateur.
          await userRepository.incrementRefreshTokenVersion(stored.userId);
          await client.query('COMMIT');
          finished = true;
          throw new AppError('Session compromise, veuillez vous reconnecter', 401);
        }

        if (new Date(stored.expiresAt).getTime() <= Date.now()) {
          await refreshTokenRepository.revoke(stored.id, {}, client);
          await client.query('COMMIT');
          finished = true;
          throw new AppError('Refresh token invalide ou expiré', 401);
        }

        const user = await userRepository.findById(stored.userId);
        if (!user) {
          await refreshTokenRepository.revokeFamily(stored.familyId, client);
          await client.query('COMMIT');
          finished = true;
          throw new AppError('Session révoquée, veuillez vous reconnecter', 401);
        }

        if (!isEmailVerified(user)) {
          await refreshTokenRepository.revokeFamily(stored.familyId, client);
          await client.query('COMMIT');
          finished = true;
          throw new AppError('Confirmez votre email avant de vous connecter', 403);
        }

        const opaque = tokenService.rotateOpaqueRefreshToken(stored.familyId);
        const next = await refreshTokenRepository.create(
          {
            userId: user.id,
            tokenHash: opaque.tokenHash,
            familyId: opaque.familyId,
            // Conserve l’échéance et le début de session (détection « Se souvenir de moi »).
            expiresAt: stored.expiresAt,
            createdAt: stored.createdAt,
            userAgent: meta.userAgent ?? null,
            ip: meta.ip ?? null,
          },
          client
        );

        await refreshTokenRepository.revoke(stored.id, { replacedBy: next.id }, client);
        await client.query('COMMIT');
        finished = true;

        return {
          user: sanitizeUser(user),
          tokens: {
            accessToken: tokenService.generateAccessToken(user),
            refreshToken: opaque.token,
          },
          sessionMeta: {
            expiresAt: stored.expiresAt,
            createdAt: stored.createdAt,
          },
        };
      } catch (error) {
        if (!finished) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // ignore
          }
        }
        throw error;
      } finally {
        client.release();
      }
    },

    /**
     * Révoque la session courante (refresh présenté).
     * Sans refresh cookie mais avec userId : révoque toutes les sessions + bump rv.
     */
    async logout({ userId = null, refreshToken = null } = {}) {
      if (refreshToken) {
        try {
          const hash = tokenService.hashRefreshToken(refreshToken);
          const client = await pool.connect();
          let finished = false;
          try {
            await client.query('BEGIN');
            const stored = await refreshTokenRepository.findByHashForUpdate(hash, client);
            let bumpUserId = null;
            if (stored && !stored.revokedAt) {
              await refreshTokenRepository.revokeFamily(stored.familyId, client);
              bumpUserId = stored.userId;
            }
            await client.query('COMMIT');
            finished = true;
            if (bumpUserId) {
              // Invalide l’access JWT (anti-rejeu après logout / vol de cookie).
              await userRepository.incrementRefreshTokenVersion(bumpUserId);
            }
            return;
          } catch (error) {
            if (!finished) {
              try {
                await client.query('ROLLBACK');
              } catch {
                // ignore
              }
            }
            throw error;
          } finally {
            client.release();
          }
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
        }
      }

      if (userId) {
        await this.logoutAll(userId);
      }
    },

    /** Déconnexion de tous les appareils + invalidation immédiate des access JWT. */
    async logoutAll(userId) {
      await refreshTokenRepository.revokeAllForUser(userId);
      await userRepository.incrementRefreshTokenVersion(userId);
    },

    async upgradeToPaid(userId) {
      if (config.isProd) {
        // En production, le self-serve reste bloqué sauf flag env explicite.
        // La bascule Setup seule ne suffit plus en prod (anti-bypass paiement).
        if (process.env.ALLOW_SELF_SERVE_PAID !== 'true') {
          throw new AppError('Un paiement est requis pour activer un compte payant', 402);
        }
      }

      const flags = settingsService
        ? await settingsService.getFeatureFlags()
        : { selfServePaidEnabled: config.billing.selfServePaidEnabled };
      if (!flags.selfServePaidEnabled) {
        throw new AppError('Un paiement est requis pour activer un compte payant', 402);
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        throw new AppError('Utilisateur introuvable', 404);
      }
      if (user.plan === PLANS.PAID || user.role === 'admin') {
        return sanitizeUser(user);
      }

      const updated = await userRepository.updatePlan(userId, PLANS.PAID);
      return sanitizeUser(updated);
    },

    async getAuthenticatedUser(accessToken) {
      if (!accessToken) {
        throw new AppError('Non authentifié', 401);
      }

      const payload = tokenService.verifyAccessToken(accessToken);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        throw new AppError('Utilisateur introuvable', 401);
      }

      // Révocation globale : logout-all / replay → bump rv → access JWT morts immédiatement.
      if (Number(payload.rv) !== Number(user.refreshTokenVersion)) {
        throw new AppError('Session révoquée, veuillez vous reconnecter', 401);
      }

      if (!isEmailVerified(user)) {
        throw new AppError('Confirmez votre email avant de vous connecter', 403);
      }

      return sanitizeUser(user);
    },
  };
}

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { parseDurationMs } from '../utils/duration.js';

const ACCESS_ALG = 'HS256';

function assertSigningAlgorithm() {
  // Stratégie actuelle : HS256 (HMAC) avec secret ≥ 32 octets.
  // - Adapté à un monolithe où émetteur et vérificateur partagent le secret.
  // - `algorithms` est TOUJOURS épinglé à la vérif → `alg: none` et RS/ES
  //   non attendus sont rejetés.
  // Évolution recommandée (multi-services) : RS256/ES256 avec `kid`,
  // clé privée uniquement sur le service d'auth, clé publique pour vérifier.
  if (config.jwt.algorithm !== ACCESS_ALG) {
    throw new Error(`Algorithme JWT non supporté : ${config.jwt.algorithm}`);
  }
}

function hashOpaqueToken(rawToken) {
  return crypto
    .createHmac('sha256', config.jwt.refreshSecret)
    .update(rawToken)
    .digest('hex');
}

function newOpaqueToken() {
  // 32 octets → 43 chars base64url ; non devinable, non JWT.
  return crypto.randomBytes(32).toString('base64url');
}

export const TokenService = {
  /** Access token JWT court, claims stricts. Inclut `rv` (refreshTokenVersion). */
  generateAccessToken(user) {
    assertSigningAlgorithm();
    const jti = crypto.randomUUID();
    const rv = Number(user.refreshTokenVersion);
    if (!Number.isInteger(rv) || rv < 0) {
      throw new Error('refreshTokenVersion utilisateur manquant pour signer l’access token');
    }

    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        typ: 'access',
        rv,
      },
      config.jwt.accessSecret,
      {
        algorithm: ACCESS_ALG,
        expiresIn: config.jwt.accessExpiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        jwtid: jti,
        notBefore: '0s',
      }
    );
  },

  verifyAccessToken(token) {
    assertSigningAlgorithm();
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret, {
        algorithms: [ACCESS_ALG],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        clockTolerance: config.jwt.clockToleranceSec,
      });

      if (payload.userId == null) {
        throw new AppError('Access token invalide', 401);
      }
      if (payload.typ != null && payload.typ !== 'access') {
        throw new AppError('Access token invalide (typ)', 401);
      }
      if (!Number.isInteger(Number(payload.rv)) || Number(payload.rv) < 0) {
        throw new AppError('Access token invalide (rv)', 401);
      }
      if (!payload.jti || typeof payload.jti !== 'string') {
        throw new AppError('Access token invalide (jti)', 401);
      }
      if (payload.nbf == null) {
        throw new AppError('Access token invalide (nbf)', 401);
      }
      if (payload.exp == null) {
        throw new AppError('Access token invalide (exp)', 401);
      }
      if (payload.iss !== config.jwt.issuer) {
        throw new AppError('Access token invalide (iss)', 401);
      }
      const aud = payload.aud;
      const audOk = Array.isArray(aud)
        ? aud.includes(config.jwt.audience)
        : aud === config.jwt.audience;
      if (!audOk) {
        throw new AppError('Access token invalide (aud)', 401);
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Session expirée, veuillez vous reconnecter', 401);
    }
  },

  /** Génère un refresh opaque + son hash (à persister). */
  createOpaqueRefreshToken() {
    const token = newOpaqueToken();
    return {
      token,
      tokenHash: hashOpaqueToken(token),
      familyId: crypto.randomUUID(),
    };
  },

  /** Nouveau refresh dans une famille existante (rotation). */
  rotateOpaqueRefreshToken(familyId) {
    const token = newOpaqueToken();
    return {
      token,
      tokenHash: hashOpaqueToken(token),
      familyId,
    };
  },

  hashRefreshToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError('Refresh token manquant', 401);
    }
    return hashOpaqueToken(rawToken);
  },

  refreshExpiresAt() {
    const ms = parseDurationMs(config.jwt.refreshExpiresIn) ?? 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  },
};

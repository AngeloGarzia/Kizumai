import { AppError } from '../utils/AppError.js';

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 72; // limite bcrypt effective

/**
 * Politique de mot de passe côté serveur (source de vérité).
 * Min 10, max 72, au moins une lettre et un chiffre.
 */
export function assertPasswordStrength(password) {
  const value = password == null ? '' : String(password);
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    throw new AppError(
      `Le mot de passe doit contenir entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères`,
      400
    );
  }
  if (!/[A-Za-zÀ-ÿ]/.test(value) || !/[0-9]/.test(value)) {
    throw new AppError(
      'Le mot de passe doit contenir au moins une lettre et un chiffre',
      400
    );
  }
  return value;
}

export const PASSWORD_POLICY = { min: PASSWORD_MIN, max: PASSWORD_MAX };

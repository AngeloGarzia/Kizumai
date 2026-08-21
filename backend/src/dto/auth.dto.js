import { requireString } from './helpers.js';
import { UserResponseDto } from './user.dto.js';
import { PASSWORD_POLICY, assertPasswordStrength } from '../utils/passwordPolicy.js';

export const RegisterRequestDto = {
  from(body = {}) {
    // Le plan n'est JAMAIS accepté depuis le client (source de vérité = backend / paiement).
    const password = requireString(body.password, 'password', {
      min: PASSWORD_POLICY.min,
      max: PASSWORD_POLICY.max,
    });
    assertPasswordStrength(password);
    return {
      name: requireString(body.name, 'name', { min: 2, max: 120 }),
      email: requireString(body.email, 'email', { min: 3, max: 255 }).toLowerCase(),
      password,
    };
  },
};

export const LoginRequestDto = {
  from(body = {}) {
    return {
      email: requireString(body.email, 'email', { min: 3, max: 255 }).toLowerCase(),
      password: requireString(body.password, 'password', { min: 1, max: PASSWORD_POLICY.max }),
    };
  },
};

export const AuthResponseDto = {
  fromUser(user) {
    return { user: UserResponseDto.from(user) };
  },
};

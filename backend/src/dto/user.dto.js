import { omit, optionalString, parseId, pick, requireString } from './helpers.js';

export const UserResponseDto = {
  from(user) {
    if (!user) return null;
    const clean = omit(user, [
      'password',
      'refreshTokenVersion',
      'emailVerificationTokenHash',
      'emailVerificationExpiresAt',
    ]);
    return {
      ...clean,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  },
  fromMany(users) {
    return (users || []).map((u) => UserResponseDto.from(u));
  },
};

export const UpdateUserRequestDto = {
  from(body) {
    const data = pick(body, ['name']);
    if (data.name !== undefined) {
      data.name = requireString(data.name, 'name', { min: 2, max: 120 });
    }
    return data;
  },
};

export const UserIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};

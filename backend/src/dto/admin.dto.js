import { AppError } from '../utils/AppError.js';
import { optionalString, parseId, pick, requireString } from './helpers.js';
import { UserResponseDto } from './user.dto.js';
import { assertSafeExternalUrl } from '../utils/ssrf.js';

export const UpdateSettingsRequestDto = {
  from(body = {}) {
    return {
      aiProvider: optionalString(body.aiProvider, { max: 40 }),
      aiModel: optionalString(body.aiModel, { max: 120 }),
      aiTemperature:
        body.aiTemperature != null && body.aiTemperature !== ''
          ? String(body.aiTemperature).slice(0, 8)
          : undefined,
    };
  },
};

export const UpsertAppSettingRequestDto = {
  from(params, body = {}) {
    return {
      key: requireString(params.key || body.key, 'key', { min: 2, max: 100 }),
      value: requireString(body.value, 'value', { min: 1, max: 20000 }),
    };
  },
};

export const UpdatePromptRequestDto = {
  from(params, body = {}) {
    const data = pick(body, ['name', 'content', 'role']);
    return {
      key: requireString(params.key, 'key', { min: 1, max: 80 }),
      name: data.name != null ? requireString(data.name, 'name', { min: 1, max: 200 }) : undefined,
      role: data.role != null ? requireString(data.role, 'role', { min: 1, max: 40 }) : undefined,
      content:
        data.content != null
          ? requireString(data.content, 'content', { min: 1, max: 100_000 })
          : undefined,
    };
  },
};

export const UpdateUserRoleRequestDto = {
  from(params, body = {}) {
    const role = requireString(body.role, 'role', { min: 1, max: 40 });
    if (role !== 'admin' && role !== 'user') {
      throw new AppError('Rôle invalide', 400);
    }
    return {
      id: parseId(params.id),
      role,
    };
  },
};

export const BroadcastNotificationRequestDto = {
  from(body = {}) {
    const title = requireString(body.title, 'title', { min: 1, max: 120 });
    const message = requireString(body.body, 'body', { min: 1, max: 2000 });
    let url;
    if (body.url) {
      url = assertSafeExternalUrl(String(body.url).trim(), { allowRelative: true });
    }
    return { title, body: message, url };
  },
};

export const AdminUserResponseDto = {
  from(user) {
    return UserResponseDto.from(user);
  },
  fromMany(users) {
    return UserResponseDto.fromMany(users);
  },
};

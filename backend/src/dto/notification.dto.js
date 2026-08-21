import { AppError } from '../utils/AppError.js';
import { optionalString } from './helpers.js';

export const SubscribeNotificationRequestDto = {
  from(body = {}) {
    if (!body.subscription || typeof body.subscription !== 'object') {
      throw new AppError('Abonnement push invalide', 400);
    }
    return {
      subscription: body.subscription,
    };
  },
};

export const UnsubscribeNotificationRequestDto = {
  from(body = {}) {
    const endpoint = optionalString(body.endpoint, { max: 2000 });
    if (!endpoint) throw new AppError('Endpoint requis', 400);
    return { endpoint };
  },
};

export const NotificationConfigResponseDto = {
  from({ enabled, publicKey }) {
    return { enabled: Boolean(enabled), publicKey: publicKey || '' };
  },
};

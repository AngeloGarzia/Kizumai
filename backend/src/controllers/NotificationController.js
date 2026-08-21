import {
  NotificationConfigResponseDto,
  SubscribeNotificationRequestDto,
  UnsubscribeNotificationRequestDto,
} from '../dto/notification.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createNotificationController({ pushService }) {
  return {
    getPublicKey: asyncHandler(async (req, res) => {
      successResponse(
        res,
        NotificationConfigResponseDto.from({
          enabled: pushService.isEnabled(),
          publicKey: pushService.getPublicKey(),
        })
      );
    }),

    subscribe: asyncHandler(async (req, res) => {
      const dto = SubscribeNotificationRequestDto.from(req.body);
      const subscription = await pushService.subscribe(
        req.user.id,
        dto.subscription,
        req.get('user-agent')
      );
      successResponse(res, { subscription }, 201);
    }),

    unsubscribe: asyncHandler(async (req, res) => {
      const dto = UnsubscribeNotificationRequestDto.from(req.body);
      await pushService.unsubscribe(req.user.id, dto.endpoint);
      successResponse(res, { message: 'Désabonné' });
    }),
  };
}

import { PushService } from '../services/PushService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const NotificationController = {
  getPublicKey: asyncHandler(async (req, res) => {
    successResponse(res, {
      enabled: PushService.isEnabled(),
      publicKey: PushService.getPublicKey(),
    });
  }),

  subscribe: asyncHandler(async (req, res) => {
    const subscription = await PushService.subscribe(
      req.user.id,
      req.body.subscription,
      req.get('user-agent')
    );
    successResponse(res, { subscription }, 201);
  }),

  unsubscribe: asyncHandler(async (req, res) => {
    await PushService.unsubscribe(req.body.endpoint);
    successResponse(res, { message: 'Désabonné' });
  }),
};

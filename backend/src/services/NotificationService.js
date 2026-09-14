import { config } from '../config/index.js';
import { TransactionalMail } from './TransactionalMail.js';

function sanitizeHttpUrl(url) {
  if (!url) return config.publicAppUrl || config.appUrl;
  try {
    const base = config.publicAppUrl || config.appUrl;
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return base;
    }
    const app = new URL(base);
    if (parsed.origin !== app.origin) {
      // Uniquement chemins same-origin (anti open-redirect).
      return base;
    }
    return parsed.toString();
  } catch {
    return config.publicAppUrl || config.appUrl;
  }
}

export function createNotificationService({
  userRepository,
  pushSubscriptionRepository,
  pushService,
}) {
  return {
    async notifyUser(userId, payload) {
      const result = { channel: 'none', pushDelivered: 0, emailSent: false };
      const safePayload = {
        title: String(payload.title || ''),
        body: String(payload.body || ''),
        url: sanitizeHttpUrl(payload.url),
      };

      const subscriptions = pushService.isEnabled()
        ? await pushSubscriptionRepository.findByUserId(userId)
        : [];

      if (subscriptions.length > 0) {
        result.pushDelivered = await pushService.sendToSubscriptions(
          subscriptions,
          safePayload
        );
        if (result.pushDelivered > 0) {
          result.channel = 'push';
          return result;
        }
      }

      const user = await userRepository.findById(userId);
      if (!user?.email) return result;

      let sendResult;
      if (payload.emailTemplate === 'planner-reminder' && payload.emailVars) {
        sendResult = await TransactionalMail.sendPlannerReminderEmail({
          to: user.email,
          ...payload.emailVars,
          url: safePayload.url,
        });
      } else if (payload.emailTemplate === 'project-progress' && payload.emailVars) {
        sendResult = await TransactionalMail.sendProjectProgressEmail({
          to: user.email,
          ...payload.emailVars,
          url: safePayload.url,
        });
      } else {
        sendResult = await TransactionalMail.sendGenericNotificationEmail({
          to: user.email,
          title: safePayload.title,
          body: safePayload.body,
          url: safePayload.url,
        });
      }

      result.emailSent = Boolean(sendResult?.ok && !sendResult?.skipped);
      result.channel = sendResult?.ok ? 'email' : result.channel;
      return result;
    },

    async broadcast(payload) {
      const users = await userRepository.findAll();
      const summary = { recipients: users.length, push: 0, email: 0 };

      for (const user of users) {
        const res = await this.notifyUser(user.id, payload);
        if (res.channel === 'push') summary.push += 1;
        else if (res.channel === 'email') summary.email += 1;
      }

      return summary;
    },
  };
}

import { config } from '../config/index.js';
import { UserModel } from '../models/UserModel.js';
import { PushSubscriptionModel } from '../models/PushSubscriptionModel.js';
import { PushService } from './PushService.js';
import { EmailService } from './EmailService.js';

function buildEmailFromPayload({ title, body, url }) {
  const link = url || config.appUrl;
  const text = `${body}\n\n${link}`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px">${title}</h2>
      <p style="margin:0 0 16px">${body}</p>
      <p><a href="${link}" style="color:#7c3aed">Ouvrir Kizumai</a></p>
    </div>
  `;
  return { subject: title, text, html };
}

export const NotificationService = {
  // Notifie un utilisateur : push s'il a au moins un abonnement, sinon email.
  // Couvre automatiquement iOS non installé (aucun abonnement => email).
  async notifyUser(userId, payload) {
    const result = { channel: 'none', pushDelivered: 0, emailSent: false };

    const subscriptions = PushService.isEnabled()
      ? await PushSubscriptionModel.findByUserId(userId)
      : [];

    if (subscriptions.length > 0) {
      result.pushDelivered = await PushService.sendToSubscriptions(subscriptions, payload);
      if (result.pushDelivered > 0) {
        result.channel = 'push';
        return result;
      }
    }

    // Repli email (aucun abonnement, ou tous expirés).
    const user = await UserModel.findById(userId);
    if (user?.email) {
      const { subject, text, html } = buildEmailFromPayload(payload);
      const { skipped } = await EmailService.send({ to: user.email, subject, text, html });
      result.emailSent = !skipped;
      result.channel = 'email';
    }

    return result;
  },

  async broadcast(payload) {
    const users = await UserModel.findAll();
    const summary = { recipients: users.length, push: 0, email: 0 };

    for (const user of users) {
      const res = await this.notifyUser(user.id, payload);
      if (res.channel === 'push') summary.push += 1;
      else if (res.channel === 'email') summary.email += 1;
    }

    return summary;
  },
};

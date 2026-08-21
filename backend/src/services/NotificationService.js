import { config } from '../config/index.js';
import { EmailService } from './EmailService.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHttpUrl(url) {
  if (!url) return config.appUrl;
  try {
    const parsed = new URL(url, config.appUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return config.appUrl;
    }
    const app = new URL(config.appUrl);
    if (parsed.origin !== app.origin) {
      // Uniquement chemins same-origin (anti open-redirect).
      return config.appUrl;
    }
    return parsed.toString();
  } catch {
    return config.appUrl;
  }
}

function buildEmailFromPayload({ title, body, url }) {
  const link = sanitizeHttpUrl(url);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeLink = escapeHtml(link);
  const text = `${body}\n\n${link}`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px">${safeTitle}</h2>
      <p style="margin:0 0 16px">${safeBody}</p>
      <p><a href="${safeLink}" style="color:#7c3aed">Ouvrir Kizumai</a></p>
    </div>
  `;
  return { subject: String(title || 'Kizumai'), text, html };
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
      if (user?.email) {
        const { subject, text, html } = buildEmailFromPayload(safePayload);
        const { skipped } = await EmailService.send({
          to: user.email,
          subject,
          text,
          html,
        });
        result.emailSent = !skipped;
        result.channel = 'email';
      }

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

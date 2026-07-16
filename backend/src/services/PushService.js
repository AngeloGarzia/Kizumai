import webpush from 'web-push';
import { config } from '../config/index.js';
import { PushSubscriptionModel } from '../models/PushSubscriptionModel.js';
import { AppError } from '../utils/AppError.js';

let configured = false;

function ensureConfigured() {
  if (!config.push.enabled) {
    throw new AppError('Notifications push non configurées sur le serveur', 503);
  }
  if (!configured) {
    webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
    configured = true;
  }
}

export const PushService = {
  isEnabled() {
    return config.push.enabled;
  },

  getPublicKey() {
    return config.push.publicKey;
  },

  async subscribe(userId, subscription, userAgent) {
    ensureConfigured();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      throw new AppError('Abonnement push invalide', 400);
    }

    return PushSubscriptionModel.upsert({ userId, endpoint, p256dh, auth, userAgent });
  },

  async unsubscribe(endpoint) {
    if (!endpoint) throw new AppError('Endpoint requis', 400);
    return PushSubscriptionModel.deleteByEndpoint(endpoint);
  },

  // Envoie une notification à un ensemble d'abonnements. Purge automatiquement
  // les abonnements expirés (410 Gone / 404). Renvoie le nombre d'envois réussis.
  async sendToSubscriptions(subscriptions, payload) {
    ensureConfigured();
    const body = JSON.stringify(payload);
    let delivered = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            body
          );
          delivered += 1;
        } catch (error) {
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            await PushSubscriptionModel.deleteByEndpoint(sub.endpoint);
          } else {
            console.warn(`[push] Échec d'envoi (${error?.statusCode || '??'}): ${error.message}`);
          }
        }
      })
    );

    return delivered;
  },
};

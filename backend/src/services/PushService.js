import webpush from 'web-push';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { assertSafePushEndpoint } from '../utils/pushEndpoint.js';

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

export function createPushService({ pushSubscriptionRepository }) {
  return {
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

      const safeEndpoint = await assertSafePushEndpoint(endpoint);

      const existing = await pushSubscriptionRepository.findByEndpoint(safeEndpoint);
      if (existing && existing.userId !== userId) {
        throw new AppError('Cet abonnement push est déjà lié à un autre compte', 409);
      }

      const saved = await pushSubscriptionRepository.upsert({
        userId,
        endpoint: safeEndpoint,
        p256dh,
        auth,
        userAgent,
      });
      if (!saved) {
        throw new AppError('Impossible d\'enregistrer l\'abonnement push', 409);
      }
      return saved;
    },

    async unsubscribe(userId, endpoint) {
      if (!endpoint) throw new AppError('Endpoint requis', 400);
      const safeEndpoint = await assertSafePushEndpoint(endpoint);
      const deleted = await pushSubscriptionRepository.deleteByEndpointForUser(
        safeEndpoint,
        userId
      );
      if (!deleted) {
        throw new AppError('Abonnement introuvable', 404);
      }
      return true;
    },

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
              await pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
            } else {
              console.warn(`[push] Échec d'envoi (${error?.statusCode || '??'}): ${error.message}`);
            }
          }
        })
      );

      return delivered;
    },
  };
}

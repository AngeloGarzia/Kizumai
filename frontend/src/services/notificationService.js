import { api } from './api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

async function getRegistration() {
  return navigator.serviceWorker.ready;
}

export const notificationService = {
  async getServerConfig() {
    const { data } = await api.get('/notifications/vapid-public-key');
    return data;
  },

  async getSubscription() {
    if (!isPushSupported()) return null;
    const reg = await getRegistration();
    return reg.pushManager.getSubscription();
  },

  async subscribe() {
    if (!isPushSupported()) {
      throw new Error('Notifications non supportées sur cet appareil');
    }

    const { enabled, publicKey } = await this.getServerConfig();
    if (!enabled || !publicKey) {
      throw new Error('Notifications push non activées côté serveur');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission de notification refusée');
    }

    const reg = await getRegistration();
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.post('/notifications/subscribe', { subscription });
    return subscription;
  },

  async unsubscribe() {
    const subscription = await this.getSubscription();
    if (!subscription) return;
    await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  },
};

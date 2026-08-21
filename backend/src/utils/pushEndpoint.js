import { AppError } from './AppError.js';
import { assertSafeExternalUrlAsync } from './ssrf.js';

/**
 * Endpoints Web Push connus (FCM, Mozilla, Apple, Windows, UnifiedPush).
 */
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
  'wns.windows.com',
  'push.cdn.mozilla.net',
];

function hostAllowed(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host || host.includes(':')) return false; // rejette IPv6 littéral ici
  return PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * Valide un endpoint push (HTTPS + allowlist + SSRF DNS).
 */
export async function assertSafePushEndpoint(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new AppError('Endpoint push invalide', 400);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('Endpoint push invalide', 400);
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError('Endpoint push HTTPS requis', 400);
  }
  if (parsed.username || parsed.password) {
    throw new AppError('Endpoint push non autorisé', 400);
  }
  if (!hostAllowed(parsed.hostname)) {
    throw new AppError('Fournisseur push non autorisé', 400);
  }

  // Double contrôle SSRF (privés / metadata) même si l’hôte est allowlisté.
  await assertSafeExternalUrlAsync(trimmed, { allowRelative: false });
  return parsed.toString();
}

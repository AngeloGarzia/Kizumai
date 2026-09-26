import { routerBasename } from '../config/appBase.js';
import { publicConfig } from '../config/publicConfig.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const CSRF_COOKIE = 'kizumai_csrf';

export const AUTH_UNAUTHORIZED_EVENT = 'kizumai:unauthorized';

// Endpoints d'authentification qui ne doivent jamais déclencher de refresh
// automatique (sinon boucle infinie sur un 401).
const NO_REFRESH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/confirm-email',
  '/auth/resend-confirmation',
  '/auth/refresh',
  '/auth/csrf',
];

// Bootstrap auth : 401 géré par AuthContext (pas de redirect forcé ici).
const NO_UNAUTHORIZED_REDIRECT = new Set([
  ...NO_REFRESH_ENDPOINTS,
  '/auth/me',
  '/auth/logout',
  '/auth/logout-all',
]);

// Pages publiques : ne pas rediriger vers /login si la session expire dessus.
const PUBLIC_APP_PATHS = new Set([
  '/',
  '/parcours',
  '/creer-son-avenir',
  '/projet/recherche',
  '/projet/apercu',
  '/login',
  '/register',
  '/confirm-email',
]);

// Une seule tentative de refresh partagée à la fois, pour éviter que plusieurs
// requêtes simultanées ne lancent chacune leur propre rafraîchissement.
let refreshPromise = null;
let csrfPromise = null;
let unauthorizedHandled = false;
/** True after a successful auth in this page lifetime — enables hard redirect on expiry. */
let sessionActive = false;

export function markSessionActive(active) {
  sessionActive = !!active;
  if (active) unauthorizedHandled = false;
}

function getAppPathname() {
  if (typeof window === 'undefined') return '/';
  const path = window.location.pathname;
  const base = routerBasename || '';
  if (base && (path === base || path.startsWith(`${base}/`))) {
    return path.slice(base.length) || '/';
  }
  return path || '/';
}

function handleUnauthorized() {
  if (unauthorizedHandled || typeof window === 'undefined') return;
  unauthorizedHandled = true;

  const appPath = getAppPathname();
  const shouldHardRedirect = sessionActive && !PUBLIC_APP_PATHS.has(appPath);
  sessionActive = false;

  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));

  if (!shouldHardRedirect) return;

  const base = routerBasename || '';
  const loginUrl = `${base}/login`;
  if (window.location.pathname === loginUrl || window.location.pathname === `${loginUrl}/`) {
    return;
  }
  window.location.assign(loginUrl);
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken() {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!csrfPromise) {
    csrfPromise = fetch(`${publicConfig.apiUrl}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json().catch(() => ({}));
        return body?.data?.csrfToken || readCookie(CSRF_COOKIE);
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
}

export function getCsrfHeaders() {
  const token = readCookie(CSRF_COOKIE);
  return token ? { 'X-CSRF-Token': token } : {};
}

async function attemptRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrfToken();
      const res = await fetch(`${publicConfig.apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
      });
      return res.ok;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function rawRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrfToken();
  }

  return fetch(`${publicConfig.apiUrl}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
      ...options.headers,
    },
  });
}

async function request(endpoint, options = {}) {
  let response = await rawRequest(endpoint, options);

  // Sur access token expiré, on tente un refresh transparent puis on rejoue
  // la requête une seule fois.
  if (
    response.status === 401 &&
    !NO_REFRESH_ENDPOINTS.includes(endpoint) &&
    !options._retried
  ) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      response = await rawRequest(endpoint, { ...options, _retried: true });
    }
  }

  if (
    response.status === 401 &&
    !NO_UNAUTHORIZED_REDIRECT.has(endpoint)
  ) {
    handleUnauthorized();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || 'Erreur réseau', response.status);
  }

  unauthorizedHandled = false;
  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, body) =>
    request(endpoint, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};

export { ApiError };

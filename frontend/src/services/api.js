import { publicConfig } from '../config/publicConfig.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Endpoints d'authentification qui ne doivent jamais déclencher de refresh
// automatique (sinon boucle infinie sur un 401).
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

// Une seule tentative de refresh partagée à la fois, pour éviter que plusieurs
// requêtes simultanées ne lancent chacune leur propre rafraîchissement.
let refreshPromise = null;

async function attemptRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${publicConfig.apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function rawRequest(endpoint, options) {
  return fetch(`${publicConfig.apiUrl}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || 'Erreur réseau', response.status);
  }

  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export { ApiError };

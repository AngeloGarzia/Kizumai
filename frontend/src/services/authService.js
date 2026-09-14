import { api } from './api.js';

export const authService = {
  async register({ name, email, password }) {
    // Le plan n'est jamais envoyé au client — décidé uniquement côté serveur.
    const { data } = await api.post('/auth/register', { name, email, password });
    return data;
  },

  async confirmEmail(token) {
    const { data } = await api.post('/auth/confirm-email', { token });
    return data.user;
  },

  async resendConfirmation(email) {
    const { data } = await api.post('/auth/resend-confirmation', { email });
    return data;
  },

  async login(email, password, { rememberMe = true } = {}) {
    const { data } = await api.post('/auth/login', { email, password, rememberMe });
    return data.user;
  },

  async logout() {
    await api.post('/auth/logout');
  },

  async logoutAll() {
    await api.post('/auth/logout-all');
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  async refreshSession() {
    const { data } = await api.post('/auth/refresh');
    return data.user;
  },

  async getBillingConfig() {
    const { data } = await api.get('/auth/billing-config');
    return data;
  },

  async upgradeToPaid() {
    const { data } = await api.post('/auth/upgrade');
    return data.user;
  },
};

import { api } from './api.js';

export const authService = {
  async register(name, email, password) {
    const { data } = await api.post('/auth/register', { name, email, password });
    return data.user;
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    return data.user;
  },

  async logout() {
    await api.post('/auth/logout');
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  async refreshSession() {
    const { data } = await api.post('/auth/refresh');
    return data.user;
  },
};

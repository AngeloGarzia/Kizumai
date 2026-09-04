import { api } from './api.js';

export const userService = {
  async getById(id) {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  },
};

import { api } from './api.js';

export const adminService = {
  getSettings() {
    return api.get('/admin/settings').then((r) => r.data);
  },

  updateSettings(data) {
    return api.put('/admin/settings', data).then((r) => r.data);
  },

  getPrompts() {
    return api.get('/admin/prompts').then((r) => r.data);
  },

  updatePrompt(key, data) {
    return api.put(`/admin/prompts/${key}`, data).then((r) => r.data);
  },

  getUsers() {
    return api.get('/admin/users').then((r) => r.data);
  },

  updateUserRole(id, role) {
    return api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data);
  },

  getConnections() {
    return api.get('/admin/connections').then((r) => r.data);
  },

  broadcastNotification(payload) {
    return api.post('/admin/notifications/broadcast', payload).then((r) => r.data);
  },
};

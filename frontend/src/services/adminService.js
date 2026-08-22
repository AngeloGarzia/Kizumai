import { api } from './api.js';

export const adminService = {
  getSettings() {
    return api.get('/admin/settings').then((r) => r.data);
  },

  updateSettings(data) {
    return api.put('/admin/settings', data).then((r) => r.data);
  },

  testAiEngine(data) {
    return api.post('/admin/settings/test-ai', data).then((r) => r.data);
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

  getSetup() {
    return api.get('/admin/setup').then((r) => r.data);
  },

  upsertAppSetting(key, value) {
    return api.put(`/admin/app-settings/${encodeURIComponent(key)}`, { value }).then((r) => r.data);
  },

  deleteAppSetting(key) {
    return api.delete(`/admin/app-settings/${encodeURIComponent(key)}`).then((r) => r.data);
  },
};

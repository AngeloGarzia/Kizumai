import { api } from './api.js';

export const plannerService = {
  async list({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    const { data } = await api.get(`/planner/events${query ? `?${query}` : ''}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/planner/events', payload);
    return data.event;
  },

  async update(id, payload) {
    const { data } = await api.patch(`/planner/events/${id}`, payload);
    return data.event;
  },

  async remove(id) {
    await api.delete(`/planner/events/${id}`);
  },
};

export const EVENT_KINDS = [
  { value: 'task', label: 'Tâche', color: '#7c9a3b' },
  { value: 'deadline', label: 'Échéance', color: '#e0a72e' },
  { value: 'appointment', label: 'Rendez-vous', color: '#6b4a8a' },
  { value: 'reminder', label: 'Rappel', color: '#4a90a4' },
];

export const EVENT_STATUSES = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
];

export function kindColor(kind) {
  return EVENT_KINDS.find((k) => k.value === kind)?.color || '#7c9a3b';
}

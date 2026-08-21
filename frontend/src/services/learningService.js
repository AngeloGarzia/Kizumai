import { api } from './api.js';

export const learningService = {
  list({ projectId, recordType } = {}) {
    const params = new URLSearchParams();
    if (projectId != null) params.set('projectId', String(projectId));
    if (recordType) params.set('recordType', recordType);
    const q = params.toString();
    return api.get(`/learning-records${q ? `?${q}` : ''}`).then((r) => r.data.records || []);
  },

  get(id) {
    return api.get(`/learning-records/${id}`).then((r) => r.data.record);
  },

  create(payload) {
    return api.post('/learning-records', payload).then((r) => r.data.record);
  },

  update(id, payload) {
    return api.patch(`/learning-records/${id}`, payload).then((r) => r.data.record);
  },

  remove(id) {
    return api.delete(`/learning-records/${id}`).then((r) => r.data);
  },
};

export const RECORD_TYPE_OPTIONS = [
  { value: 'formation', label: 'Formation' },
  { value: 'diplome', label: 'Diplôme' },
  { value: 'etude', label: 'Étude' },
  { value: 'bilan_competences', label: 'Bilan de compétences' },
];

export const RECORD_STATUS_OPTIONS = [
  { value: 'envisage', label: 'Envisagé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'abandonne', label: 'Abandonné' },
];

export function competencesPercent(records = []) {
  if (!records.length) return 0;
  const weights = { termine: 1, en_cours: 0.6, envisage: 0.3, abandonne: 0 };
  const score = records.reduce((sum, r) => sum + (weights[r.status] ?? 0.3), 0);
  return Math.min(100, Math.round((score / 5) * 100));
}

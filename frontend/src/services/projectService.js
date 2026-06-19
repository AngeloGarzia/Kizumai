import { api } from './api.js';

export const projectService = {
  async createProject({ quoi, ou, budget, currency }) {
    const { data } = await api.post('/projects', { quoi, ou, budget, currency });
    return data.project;
  },
};

export const PROJECT_DRAFT_KEY = 'myrokay_project_draft';

export function saveProjectDraft(draft) {
  sessionStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(draft));
}

export function getProjectDraft() {
  const raw = sessionStorage.getItem(PROJECT_DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearProjectDraft() {
  sessionStorage.removeItem(PROJECT_DRAFT_KEY);
}

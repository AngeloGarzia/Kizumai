import { api } from './api.js';
import { publicConfig } from '../config/publicConfig.js';

export const projectService = {
  async previewProject({ quoi, ou, budget, currency }) {
    const { data } = await api.post('/projects/preview', { quoi, ou, budget, currency });
    return data.preview;
  },

  async createProject({ quoi, ou, budget, currency, title, report, sections }) {
    const { data } = await api.post('/projects', {
      quoi,
      ou,
      budget,
      currency,
      title,
      report,
      sections,
    });
    return data.project;
  },

  // --- Parcours de recherche en 3 phases ---

  async searchBusinesses({ quoi, ou, budget, currency, refine, avoid }) {
    const { data } = await api.post('/projects/search/businesses', {
      quoi,
      ou,
      budget,
      currency,
      refine,
      avoid,
    });
    return data.businesses;
  },

  async searchLocations({
    business,
    businessActivity,
    businessPitch,
    businessRationale,
    ou,
    budget,
    currency,
    refine,
    avoid,
  }) {
    const { data } = await api.post('/projects/search/locations', {
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      ou,
      budget,
      currency,
      refine,
      avoid,
    });
    return data.locations;
  },

  async buildProposals({ business, location, budget, currency, refine }) {
    const { data } = await api.post('/projects/search/proposals', {
      business,
      location,
      budget,
      currency,
      refine,
    });
    return {
      proposals: data.proposals || [],
      assessment: data.assessment || { userBudgetTooHigh: false, message: '' },
    };
  },

  async getMine() {
    const { data } = await api.get('/projects/mine');
    return data;
  },

  async getProject(id) {
    const { data } = await api.get(`/projects/${id}`);
    return data.project;
  },

  async updateProject(id, fields) {
    const { data } = await api.patch(`/projects/${id}`, fields);
    return data.project;
  },

  async listDocuments(projectId) {
    const { data } = await api.get(`/projects/${projectId}/documents`);
    return data;
  },

  // Upload multipart : on n'utilise pas le wrapper JSON (le navigateur doit
  // fixer lui-même le boundary multipart).
  async uploadDocument(projectId, file, title) {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);

    const response = await fetch(`${publicConfig.apiUrl}/projects/${projectId}/documents`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Échec du téléversement');
    }
    return data.data.document;
  },

  documentDownloadUrl(projectId, documentId) {
    return `${publicConfig.apiUrl}/projects/${projectId}/documents/${documentId}/download`;
  },

  async deleteDocument(projectId, documentId) {
    await api.delete(`/projects/${projectId}/documents/${documentId}`);
  },
};

export const SEARCH_SEED_KEY = 'kizumai_search_seed';

export function saveSearchSeed(seed) {
  sessionStorage.setItem(SEARCH_SEED_KEY, JSON.stringify(seed));
}

export function getSearchSeed() {
  const raw = sessionStorage.getItem(SEARCH_SEED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(SEARCH_SEED_KEY);
    return null;
  }
}

export function clearSearchSeed() {
  sessionStorage.removeItem(SEARCH_SEED_KEY);
}

export const PROJECT_DRAFT_KEY = 'kizumai_project_draft';

export function saveProjectDraft(draft) {
  sessionStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(draft));
}

export function getProjectDraft() {
  const raw = sessionStorage.getItem(PROJECT_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Valeur corrompue : on nettoie plutôt que de laisser planter le rendu.
    sessionStorage.removeItem(PROJECT_DRAFT_KEY);
    return null;
  }
}

export function clearProjectDraft() {
  sessionStorage.removeItem(PROJECT_DRAFT_KEY);
}

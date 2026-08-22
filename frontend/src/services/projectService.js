import { api, ensureCsrfToken, getCsrfHeaders } from './api.js';
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

  async searchBusinesses({ quoi, ou, budget, currency, refine, avoid, projectId }) {
    const { data } = await api.post('/projects/search/businesses', {
      quoi,
      ou,
      budget,
      currency,
      refine,
      avoid,
      projectId,
    });
    return data.businesses;
  },

  async suggestLocations(query) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const { data } = await api.get(`/projects/locations/suggest?q=${encodeURIComponent(q)}`);
    return data.locations || [];
  },

  async searchTrainings({
    business,
    businessActivity,
    businessPitch,
    businessRationale,
    quoi,
    ou,
    budget,
    currency,
    refine,
    avoid,
    projectId,
  }) {
    const { data } = await api.post('/projects/search/trainings', {
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      quoi,
      ou,
      budget,
      currency,
      refine,
      avoid,
      projectId,
    });
    return data.trainings;
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
    projectId,
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
      projectId,
    });
    return data.locations;
  },

  async buildProposals({ business, location, budget, currency, refine, projectId }) {
    const { data } = await api.post('/projects/search/proposals', {
      business,
      location,
      budget,
      currency,
      refine,
      projectId,
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

  async getSituationSummary(intent = '') {
    const { data } = await api.post('/projects/mine/memory/situation', { intent });
    return data.situation;
  },

  async getSituationSummaryForProject(projectId, intent = '') {
    const { data } = await api.post(`/projects/${projectId}/memory/situation`, { intent });
    return data.situation;
  },

  async scanProjectMemory() {
    const { data } = await api.post('/projects/mine/memory/scan', {});
    return data.scan;
  },

  async scanProjectMemoryForProject(projectId) {
    const { data } = await api.post(`/projects/${projectId}/memory/scan`, {});
    return data.scan;
  },

  async getTimeline(limit = 200) {
    const { data } = await api.get(`/projects/mine/timeline?limit=${Number(limit) || 200}`);
    return data.timeline;
  },

  async getTimelineForProject(projectId, limit = 200) {
    const { data } = await api.get(
      `/projects/${projectId}/timeline?limit=${Number(limit) || 200}`
    );
    return data.timeline;
  },

  async updateProject(id, fields) {
    const { data } = await api.patch(`/projects/${id}`, fields);
    return data.project;
  },

  async updateProjectLocation(id, fields) {
    const { data } = await api.put(`/projects/${id}/location`, fields);
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

    await ensureCsrfToken();
    const response = await fetch(`${publicConfig.apiUrl}/projects/${projectId}/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getCsrfHeaders(),
      },
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

  async getResources(projectId) {
    const { data } = await api.get(`/projects/${projectId}/resources`);
    return data;
  },

  async getDocument(projectId, documentId) {
    const { data } = await api.get(`/projects/${projectId}/documents/${documentId}`);
    return data.document;
  },

  async updateDocument(projectId, documentId, fields) {
    const { data } = await api.patch(`/projects/${projectId}/documents/${documentId}`, fields);
    return data.document;
  },

  async getDocumentTextPreview(projectId, documentId) {
    const { data } = await api.get(`/projects/${projectId}/documents/${documentId}/preview-text`);
    return data;
  },

  async linkDocumentContact(projectId, documentId, payload) {
    const { data } = await api.post(
      `/projects/${projectId}/documents/${documentId}/contacts`,
      payload
    );
    return data.document;
  },

  async unlinkDocumentContact(projectId, documentId, contactId) {
    const { data } = await api.delete(
      `/projects/${projectId}/documents/${documentId}/contacts/${contactId}`
    );
    return data.document;
  },

  async listResourceCategories(projectId) {
    const { data } = await api.get(`/projects/${projectId}/resource-categories`);
    return data.categories;
  },

  async deleteDocument(projectId, documentId) {
    await api.delete(`/projects/${projectId}/documents/${documentId}`);
  },

  async getDocumentScan(projectId, scanId) {
    const { data } = await api.get(`/projects/${projectId}/scans/${scanId}`);
    return data;
  },

  async getLatestDocumentScan(projectId, documentId) {
    const { data } = await api.get(`/projects/${projectId}/documents/${documentId}/scans/latest`);
    return data;
  },

  async retryDocumentScan(projectId, documentId) {
    const { data } = await api.post(`/projects/${projectId}/documents/${documentId}/scans`);
    return data;
  },

  async applyDocumentScan(projectId, scanId, payload) {
    const { data } = await api.post(`/projects/${projectId}/scans/${scanId}/apply`, payload);
    return data;
  },

  async dismissDocumentScan(projectId, scanId) {
    const { data } = await api.post(`/projects/${projectId}/scans/${scanId}/dismiss`);
    return data;
  },

  async getStage(projectId, stage = 'etude_marche') {
    const { data } = await api.get(`/projects/${projectId}/stages/${stage}`);
    return data;
  },

  async updateStageTask(projectId, stage, taskId, fields) {
    const { data } = await api.patch(
      `/projects/${projectId}/stages/${stage}/tasks/${taskId}`,
      fields
    );
    return data;
  },

  async addStageLink(projectId, stage, payload) {
    const { data } = await api.post(`/projects/${projectId}/stages/${stage}/links`, payload);
    return data;
  },

  async removeStageLink(projectId, stage, linkId) {
    const { data } = await api.delete(
      `/projects/${projectId}/stages/${stage}/links/${linkId}`
    );
    return data;
  },

  async createStageContact(projectId, stage, payload) {
    const { data } = await api.post(
      `/projects/${projectId}/stages/${stage}/contacts`,
      payload
    );
    return data;
  },

  async updateStageMilestone(projectId, stage, milestoneId, fields) {
    const { data } = await api.patch(
      `/projects/${projectId}/stages/${stage}/milestones/${milestoneId}`,
      fields
    );
    return data;
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

import { AppError } from '../utils/AppError.js';
import { sanitizeUsers } from '../utils/sanitize.js';
import { UserResponseDto } from '../dto/user.dto.js';
import { ROLES } from '../constants/roles.js';
import { config } from '../config/index.js';
import pool from '../database/pool.js';
import {
  getProviderById,
  isModelValidForProvider,
  resolveModel,
} from '../config/aiProviders.js';
import {
  getLiveProviderCatalog,
  isModelInCatalog,
} from './AiModelCatalogService.js';

const KEY_RE = /^[a-z][a-z0-9_]{1,98}$/;

export function createAdminService({
  settingsRepository,
  aiPromptRepository,
  userRepository,
  projectRepository,
  documentRepository,
  projectMemorySnapshotRepository,
  storageService,
  connectionService,
  aiService,
  aiUsageLogRepository,
}) {
  async function loadAiSettings({ forceRefresh = false } = {}) {
    const settings = await settingsRepository.getAsObject();
    const aiProvider = settings.ai_provider || config.ai.defaultProvider;
    const providerDef = getProviderById(aiProvider);
    const aiModel = resolveModel(aiProvider, settings.ai_model)
      || providerDef?.defaultModel
      || config.ai.defaultModel;

    const { providers, refreshedAt, fromCache } = await getLiveProviderCatalog({
      force: forceRefresh,
      selectedProvider: aiProvider,
      selectedModel: aiModel,
    });

    return {
      aiProvider,
      aiModel,
      aiTemperature: settings.ai_temperature || '0.7',
      providers,
      modelsRefreshedAt: refreshedAt,
      modelsFromCache: fromCache,
    };
  }

  async function assertModelAllowed(providerId, modelId) {
    if (isModelValidForProvider(providerId, modelId)) return;
    const { providers } = await getLiveProviderCatalog({
      force: false,
      selectedProvider: providerId,
      selectedModel: modelId,
    });
    if (isModelInCatalog(providers, providerId, modelId)) return;
    // Re-fetch live once before rejecting (cache may be stale)
    const live = await getLiveProviderCatalog({
      force: true,
      selectedProvider: providerId,
      selectedModel: modelId,
    });
    if (isModelInCatalog(live.providers, providerId, modelId)) return;
    throw new AppError('Modèle invalide pour ce fournisseur', 400);
  }

  return {
    async getSettings() {
      return loadAiSettings({ forceRefresh: false });
    },

    async updateSettings({ aiProvider, aiModel, aiTemperature }) {
      if (aiProvider) {
        const providerDef = getProviderById(aiProvider);
        if (!providerDef) {
          throw new AppError('Fournisseur IA invalide', 400);
        }
        await settingsRepository.upsert('ai_provider', aiProvider);
      }

      if (aiModel) {
        const currentProvider = aiProvider || (await settingsRepository.findByKey('ai_provider'))?.value
          || config.ai.defaultProvider;
        await assertModelAllowed(currentProvider, aiModel);
        await settingsRepository.upsert('ai_model', aiModel);
      }

      if (aiTemperature != null) {
        const temp = Number(aiTemperature);
        if (Number.isNaN(temp) || temp < 0 || temp > 2) {
          throw new AppError('La température doit être comprise entre 0 et 2', 400);
        }
        await settingsRepository.upsert('ai_temperature', String(temp));
      }

      return loadAiSettings({ forceRefresh: false });
    },

    async testAiEngine({ aiProvider, aiModel, aiTemperature } = {}) {
      if (aiProvider && !getProviderById(aiProvider)) {
        throw new AppError('Fournisseur IA invalide', 400);
      }
      if (aiModel) {
        const providerId = aiProvider || (await settingsRepository.findByKey('ai_provider'))?.value
          || config.ai.defaultProvider;
        await assertModelAllowed(providerId, aiModel);
      }
      if (aiTemperature != null) {
        const temp = Number(aiTemperature);
        if (Number.isNaN(temp) || temp < 0 || temp > 2) {
          throw new AppError('La température doit être comprise entre 0 et 2', 400);
        }
      }
      return aiService.testCurrentEngine({
        provider: aiProvider,
        model: aiModel,
        temperature: aiTemperature,
      });
    },

    /** Bundle Setup : tous les paramètres app_settings + prompts. */
    async getSetup() {
      const rows = await settingsRepository.findAll();
      // À l'ouverture du Setup : rafraîchir les listes de modèles via les API fournisseurs
      const ai = await loadAiSettings({ forceRefresh: true });
      const prompts = await this.getPrompts();
      return {
        ai,
        settings: rows.map((r) => ({
          key: r.key,
          value: r.value,
          updatedAt: r.updated_at,
        })),
        prompts,
      };
    },

    async upsertAppSetting(key, value) {
      const k = String(key || '').trim().toLowerCase();
      if (!KEY_RE.test(k)) {
        throw new AppError(
          'Clé invalide (snake_case, 2–100 caractères, commence par une lettre)',
          400
        );
      }
      if (value == null || String(value).trim() === '') {
        throw new AppError('La valeur est requise', 400);
      }

      if (k === 'ai_provider') {
        if (!getProviderById(String(value))) {
          throw new AppError('Fournisseur IA invalide', 400);
        }
      }
      if (k === 'ai_temperature') {
        const temp = Number(value);
        if (Number.isNaN(temp) || temp < 0 || temp > 2) {
          throw new AppError('La température doit être comprise entre 0 et 2', 400);
        }
      }
      if (k === 'ai_model') {
        const provider =
          (await settingsRepository.findByKey('ai_provider'))?.value ||
          config.ai.defaultProvider;
        await assertModelAllowed(provider, String(value));
      }
      if (k === 'business_project_suggestions_count') {
        const count = Number(value);
        if (!Number.isInteger(count) || count < 1 || count > 8) {
          throw new AppError('Le nombre de projets proposés doit être un entier entre 1 et 8', 400);
        }
      }

      const row = await settingsRepository.upsert(k, String(value));
      return { key: row.key, value: row.value, updatedAt: row.updated_at };
    },

    async deleteAppSetting(key) {
      const k = String(key || '').trim().toLowerCase();
      const protectedKeys = new Set([
        'ai_provider',
        'ai_model',
        'ai_temperature',
        'budget_eur_min',
        'budget_eur_max',
        'business_project_suggestions_count',
      ]);
      if (protectedKeys.has(k)) {
        throw new AppError('Ce paramètre système ne peut pas être supprimé', 400);
      }
      const existing = await settingsRepository.findByKey(k);
      if (!existing) throw new AppError('Paramètre introuvable', 404);
      await settingsRepository.delete(k);
      return true;
    },

    async getPrompts() {
      return aiPromptRepository.findAll();
    },

    async updatePrompt(promptKey, data) {
      const prompt = await aiPromptRepository.update(promptKey, data);
      if (!prompt) throw new AppError('Prompt introuvable', 404);
      return prompt;
    },

    async getUsersOverview() {
      const users = sanitizeUsers(await userRepository.findAll());
      return {
        users,
        administrators: users.filter((u) => u.role === ROLES.ADMIN),
        regularUsers: users.filter((u) => u.role === ROLES.USER),
        totals: {
          all: users.length,
          admins: users.filter((u) => u.role === ROLES.ADMIN).length,
          users: users.filter((u) => u.role === ROLES.USER).length,
        },
      };
    },

    async getUserDetails(userId) {
      const targetId = Number(userId);
      const target = await userRepository.findById(targetId);
      if (!target) throw new AppError('Utilisateur introuvable', 404);

      const projects = await projectRepository.findByUserId(targetId);
      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          const [documents, memorySnapshot, related] = await Promise.all([
            documentRepository.findByProjectId(project.id),
            projectMemorySnapshotRepository.findByProjectId(project.id),
            pool.query(
              `SELECT
                 (SELECT COUNT(*)::int FROM project_memory_nodes WHERE project_id = $1) AS memory_nodes,
                 (SELECT COUNT(*)::int FROM project_memory_edges WHERE project_id = $1) AS memory_edges,
                 (SELECT COUNT(*)::int FROM contacts WHERE project_id = $1) AS contacts,
                 (SELECT COUNT(*)::int FROM companies WHERE project_id = $1) AS companies,
                 (SELECT COUNT(*)::int FROM planner_events WHERE project_id = $1) AS planner_events,
                 (SELECT COUNT(*)::int FROM learning_records WHERE project_id = $1) AS learning_records,
                 (SELECT COUNT(*)::int FROM document_scans WHERE project_id = $1) AS document_scans,
                 (SELECT COUNT(*)::int FROM project_stage_runs WHERE project_id = $1) AS stage_runs`,
              [project.id]
            ),
          ]);
          const counts = related.rows[0] || {};
          return {
            id: project.id,
            title: project.title,
            status: project.status,
            stage: project.stage,
            budget: project.budget,
            currency: project.currency,
            legalForm: project.legalForm,
            description: project.description,
            report: project.report,
            sections: project.sections,
            metadata: project.metadata,
            source: project.source,
            aiPrompt: project.aiPrompt,
            quoi: project.quoi,
            ou: project.ou,
            activity: project.activity,
            location: project.location,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            counts: {
              documents: documents.length,
              memoryNodes: counts.memory_nodes || 0,
              memoryEdges: counts.memory_edges || 0,
              contacts: counts.contacts || 0,
              companies: counts.companies || 0,
              plannerEvents: counts.planner_events || 0,
              learningRecords: counts.learning_records || 0,
              documentScans: counts.document_scans || 0,
              stageRuns: counts.stage_runs || 0,
            },
            documents: documents.map((d) => ({
              id: d.id,
              title: d.title,
              type: d.type,
              fileName: d.fileName,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
              storageKey: d.storageKey,
              category: d.category,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            })),
            memorySnapshot: memorySnapshot
              ? {
                  id: memorySnapshot.id,
                  summary: memorySnapshot.summary,
                  keyFacts: memorySnapshot.keyFacts,
                  activeBlockers: memorySnapshot.activeBlockers,
                  nextActions: memorySnapshot.nextActions,
                  generatedAt: memorySnapshot.generatedAt,
                  modelUsed: memorySnapshot.modelUsed,
                  tokenCount: memorySnapshot.tokenCount,
                  eventsSinceSnapshot: memorySnapshot.eventsSinceSnapshot,
                  updatedAt: memorySnapshot.updatedAt,
                }
              : null,
          };
        })
      );

      const { rows: statRows } = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS projects,
           (SELECT COUNT(*)::int FROM contacts WHERE user_id = $1) AS contacts,
           (SELECT COUNT(*)::int FROM planner_events WHERE user_id = $1) AS planner_events,
           (SELECT COUNT(*)::int FROM learning_records WHERE user_id = $1) AS learning_records,
           (SELECT COUNT(*)::int FROM document_scans WHERE user_id = $1) AS document_scans,
           (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = $1) AS push_subscriptions,
           (SELECT COUNT(*)::int FROM refresh_tokens WHERE user_id = $1) AS refresh_tokens,
           (SELECT COUNT(*)::int FROM user_connections WHERE user_id = $1) AS connections,
           (SELECT COUNT(*)::int FROM ai_usage_logs WHERE user_id = $1) AS ai_usage,
           (SELECT COUNT(*)::int FROM documents d
              INNER JOIN projects p ON p.id = d.project_id
              WHERE p.user_id = $1) AS documents`,
        [targetId]
      );
      const s = statRows[0] || {};

      return {
        user: UserResponseDto.from(target),
        stats: {
          projects: s.projects || 0,
          contacts: s.contacts || 0,
          plannerEvents: s.planner_events || 0,
          learningRecords: s.learning_records || 0,
          documentScans: s.document_scans || 0,
          documents: s.documents || 0,
          pushSubscriptions: s.push_subscriptions || 0,
          refreshTokens: s.refresh_tokens || 0,
          connections: s.connections || 0,
          aiUsage: s.ai_usage || 0,
        },
        projects: enrichedProjects,
      };
    },

    async deleteUser(userId, currentUserId) {
      const targetId = Number(userId);
      if (currentUserId != null && Number(currentUserId) === targetId) {
        throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
      }

      const target = await userRepository.findById(targetId);
      if (!target) throw new AppError('Utilisateur introuvable', 404);

      if (target.role === ROLES.ADMIN) {
        const admins = await userRepository.findByRole(ROLES.ADMIN);
        if (admins.length <= 1) {
          throw new AppError('Impossible de supprimer le dernier administrateur', 400);
        }
      }

      const projects = await projectRepository.findByUserId(targetId);
      const storageKeys = [];
      for (const project of projects) {
        const docs = await documentRepository.findByProjectId(project.id);
        for (const doc of docs) {
          if (doc.storageKey) storageKeys.push(doc.storageKey);
        }
      }

      const deleted = await userRepository.delete(targetId);
      if (!deleted) throw new AppError('Utilisateur introuvable', 404);

      if (storageService?.remove) {
        await Promise.allSettled(storageKeys.map((key) => storageService.remove(key)));
      }

      return { deleted: true, id: targetId };
    },

    async updateUserRole(userId, role, currentUserId) {
      if (![ROLES.USER, ROLES.ADMIN].includes(role)) {
        throw new AppError('Rôle invalide', 400);
      }

      const targetId = Number(userId);
      const target = await userRepository.findById(targetId);
      if (!target) throw new AppError('Utilisateur introuvable', 404);

      if (target.role === ROLES.ADMIN && role === ROLES.USER) {
        if (currentUserId != null && Number(currentUserId) === targetId) {
          throw new AppError('Vous ne pouvez pas retirer votre propre rôle administrateur', 400);
        }
        const admins = await userRepository.findByRole(ROLES.ADMIN);
        if (admins.length <= 1) {
          throw new AppError('Impossible de rétrograder le dernier administrateur', 400);
        }
      }

      const user = await userRepository.updateRole(targetId, role);
      if (!user) throw new AppError('Utilisateur introuvable', 404);
      await userRepository.incrementRefreshTokenVersion(targetId);
      return UserResponseDto.from(user);
    },

    async getConnections(limit = 100) {
      return connectionService.getRecentConnections(limit);
    },

    async getAiUsage({ days = 30 } = {}) {
      const safeDays = Math.min(90, Math.max(1, Number(days) || 30));
      const [totals, byDay, recent] = await Promise.all([
        aiUsageLogRepository.totals({ days: safeDays }),
        aiUsageLogRepository.summarizeByDay({ days: safeDays }),
        aiUsageLogRepository.findRecent({ limit: 40 }),
      ]);
      return { totals, byDay, recent };
    },
  };
}

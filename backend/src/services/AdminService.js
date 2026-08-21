import { AppError } from '../utils/AppError.js';
import { sanitizeUsers } from '../utils/sanitize.js';
import { UserResponseDto } from '../dto/user.dto.js';
import { ROLES } from '../constants/roles.js';
import { config } from '../config/index.js';
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
  connectionService,
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
      return UserResponseDto.from(user);
    },

    async getConnections(limit = 100) {
      return connectionService.getRecentConnections(limit);
    },
  };
}

import { SettingsModel } from '../models/SettingsModel.js';
import { AiPromptModel } from '../models/AiPromptModel.js';
import { UserModel } from '../models/UserModel.js';
import { ConnectionService } from './ConnectionService.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeUsers } from '../utils/sanitize.js';
import { ROLES } from '../constants/roles.js';
import { config } from '../config/index.js';
import {
  getProviderById,
  getProviderCatalog,
  isModelValidForProvider,
  resolveModel,
} from '../config/aiProviders.js';

export const AdminService = {
  async getSettings() {
    const settings = await SettingsModel.getAsObject();
    const aiProvider = settings.ai_provider || config.ai.defaultProvider;
    const providerDef = getProviderById(aiProvider);

    return {
      aiProvider,
      aiModel: resolveModel(aiProvider, settings.ai_model)
        || providerDef?.defaultModel
        || config.ai.defaultModel,
      aiTemperature: settings.ai_temperature || '0.7',
      providers: getProviderCatalog(config.ai),
    };
  },

  async updateSettings({ aiProvider, aiModel, aiTemperature }) {
    if (aiProvider) {
      const providerDef = getProviderById(aiProvider);
      if (!providerDef) {
        throw new AppError('Fournisseur IA invalide', 400);
      }
      await SettingsModel.upsert('ai_provider', aiProvider);
    }

    if (aiModel) {
      const currentProvider = aiProvider || (await SettingsModel.findByKey('ai_provider'))?.value
        || config.ai.defaultProvider;
      if (!isModelValidForProvider(currentProvider, aiModel)) {
        throw new AppError('Modèle invalide pour ce fournisseur', 400);
      }
      await SettingsModel.upsert('ai_model', aiModel);
    }

    if (aiTemperature != null) {
      const temp = Number(aiTemperature);
      if (Number.isNaN(temp) || temp < 0 || temp > 2) {
        throw new AppError('La température doit être comprise entre 0 et 2', 400);
      }
      await SettingsModel.upsert('ai_temperature', String(temp));
    }

    return this.getSettings();
  },

  async getPrompts() {
    return AiPromptModel.findAll();
  },

  async updatePrompt(promptKey, data) {
    const prompt = await AiPromptModel.update(promptKey, data);
    if (!prompt) throw new AppError('Prompt introuvable', 404);
    return prompt;
  },

  async getUsersOverview() {
    const users = sanitizeUsers(await UserModel.findAll());
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
    const target = await UserModel.findById(targetId);
    if (!target) throw new AppError('Utilisateur introuvable', 404);

    // Protection contre la perte d'accès administrateur.
    if (target.role === ROLES.ADMIN && role === ROLES.USER) {
      if (currentUserId != null && Number(currentUserId) === targetId) {
        throw new AppError('Vous ne pouvez pas retirer votre propre rôle administrateur', 400);
      }
      const admins = await UserModel.findByRole(ROLES.ADMIN);
      if (admins.length <= 1) {
        throw new AppError('Impossible de rétrograder le dernier administrateur', 400);
      }
    }

    const user = await UserModel.updateRole(targetId, role);
    if (!user) throw new AppError('Utilisateur introuvable', 404);
    const { password, refreshTokenVersion, ...publicUser } = user;
    return publicUser;
  },

  async getConnections(limit = 100) {
    return ConnectionService.getRecentConnections(limit);
  },
};

import { SettingsModel } from '../models/SettingsModel.js';
import { AiPromptModel } from '../models/AiPromptModel.js';
import { UserModel } from '../models/UserModel.js';
import { ConnectionService } from './ConnectionService.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeUsers } from '../utils/sanitize.js';
import { ROLES } from '../constants/roles.js';
import { config } from '../config/index.js';

export const AdminService = {
  async getSettings() {
    const settings = await SettingsModel.getAsObject();
    return {
      aiModel: settings.ai_model || config.ai.model,
      aiTemperature: settings.ai_temperature || '0.7',
    };
  },

  async updateSettings({ aiModel, aiTemperature }) {
    if (aiModel) await SettingsModel.upsert('ai_model', aiModel);
    if (aiTemperature != null) await SettingsModel.upsert('ai_temperature', String(aiTemperature));
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

  async updateUserRole(userId, role) {
    if (![ROLES.USER, ROLES.ADMIN].includes(role)) {
      throw new AppError('Rôle invalide', 400);
    }
    const user = await UserModel.updateRole(userId, role);
    if (!user) throw new AppError('Utilisateur introuvable', 404);
    const { password, refreshTokenVersion, ...publicUser } = user;
    return publicUser;
  },

  async getConnections(limit = 100) {
    return ConnectionService.getRecentConnections(limit);
  },
};

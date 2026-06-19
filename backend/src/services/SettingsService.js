import { SettingsModel } from '../models/SettingsModel.js';
import { AiPromptModel } from '../models/AiPromptModel.js';
import { config } from '../config/index.js';

export const SettingsService = {
  async getAiConfig() {
    const settings = await SettingsModel.getAsObject();
    const systemPrompt = await AiPromptModel.findByKey('project_system');
    const userPrompt = await AiPromptModel.findByKey('project_user');
    const lieuxPrompt = await AiPromptModel.findByKey('lieux');

    return {
      model: settings.ai_model || config.ai.model,
      temperature: Number(settings.ai_temperature ?? 0.7),
      systemPrompt: systemPrompt?.content || null,
      userPromptTemplate: userPrompt?.content || null,
      lieuxPrompt: lieuxPrompt?.content || null,
    };
  },
};

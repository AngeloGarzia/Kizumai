import { ProjectModel } from '../models/ProjectModel.js';
import { AiService } from './AiService.js';
import { CurrencyService } from './CurrencyService.js';
import { AppError } from '../utils/AppError.js';

export const ProjectService = {
  async startProject({ userId, quoi, ou, budget, currency = 'EUR' }) {
    await CurrencyService.getCurrencyData();
    const resolved = await AiService.completeProject({ quoi, ou, budget, currency });

    if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
      throw new AppError('Impossible de compléter le projet', 422);
    }

    const project = await ProjectModel.create({
      userId,
      quoi: resolved.quoi,
      ou: resolved.ou,
      budget: resolved.budget,
      currency: resolved.currency,
      source: resolved.source,
    });

    return project;
  },

  async getUserProjects(userId) {
    return ProjectModel.findByUserId(userId);
  },
};

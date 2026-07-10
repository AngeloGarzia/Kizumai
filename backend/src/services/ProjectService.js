import { ProjectModel } from '../models/ProjectModel.js';
import { AiService } from './AiService.js';
import { CurrencyService } from './CurrencyService.js';
import { AppError } from '../utils/AppError.js';
import { hasPaidAccess } from '../constants/plans.js';

export const ProjectService = {
  async previewProject({ quoi, ou, budget, currency = 'EUR' }) {
    await CurrencyService.getCurrencyData();
    const resolved = await AiService.completeProject({ quoi, ou, budget, currency });

    if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
      throw new AppError('Impossible de compléter le projet', 422);
    }

    return {
      quoi: resolved.quoi,
      ou: resolved.ou,
      budget: resolved.budget,
      currency: resolved.currency,
      source: resolved.source,
    };
  },

  async startProject({ user, quoi, ou, budget, currency = 'EUR' }) {
    if (!user?.id) {
      throw new AppError('Authentification requise pour enregistrer le projet', 401);
    }

    if (!hasPaidAccess(user)) {
      throw new AppError('Un compte payant est requis pour poursuivre le parcours', 403);
    }

    await CurrencyService.getCurrencyData();
    const resolved = await AiService.completeProject({ quoi, ou, budget, currency });

    if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
      throw new AppError('Impossible de compléter le projet', 422);
    }

    const project = await ProjectModel.create({
      userId: user.id,
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

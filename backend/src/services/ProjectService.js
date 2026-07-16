import { ProjectModel } from '../models/ProjectModel.js';
import { ActivityModel } from '../models/ActivityModel.js';
import { LocationModel } from '../models/LocationModel.js';
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
      sections: resolved.sections,
      report: resolved.report,
    };
  },

  // --- Parcours de recherche en 3 phases (public, comme l'aperçu) ---

  async searchBusinesses({ quoi, ou, budget, currency = 'EUR', refine, avoid }) {
    if (!quoi?.trim()) {
      throw new AppError("L'idée est requise pour lancer la recherche.", 400);
    }
    await CurrencyService.getCurrencyData();
    const businesses = await AiService.searchBusinesses({
      quoi: quoi.trim(),
      ou: ou?.trim() || '',
      // Le budget n'est jamais nul : clampBudget ramène toute valeur vide au
      // minimum autorisé (500 € en EUR).
      budget: CurrencyService.clampBudget(budget, currency),
      currency,
      refine: refine || '',
      avoid: Array.isArray(avoid) ? avoid : [],
    });
    if (!businesses.length) {
      throw new AppError('Aucune idée de business générée. Réessayez.', 422);
    }
    return businesses;
  },

  async searchLocations({
    business,
    businessActivity,
    businessPitch,
    businessRationale,
    ou,
    budget,
    currency = 'EUR',
    refine,
    avoid,
  }) {
    if (!business?.trim()) {
      throw new AppError('Sélectionnez un business avant de chercher un lieu.', 400);
    }
    await CurrencyService.getCurrencyData();
    const locations = await AiService.searchLocations({
      business: business.trim(),
      businessActivity: businessActivity || '',
      businessPitch: businessPitch || '',
      businessRationale: businessRationale || '',
      ou: ou?.trim() || '',
      budget: CurrencyService.clampBudget(budget, currency),
      currency,
      refine: refine || '',
      avoid: Array.isArray(avoid) ? avoid : [],
    });
    if (!locations.length) {
      throw new AppError('Aucun lieu généré. Réessayez.', 422);
    }
    return locations;
  },

  async buildProposals({ business, location, budget, currency = 'EUR', refine }) {
    if (!business?.trim() || !location?.trim()) {
      throw new AppError('Business et lieu sont requis pour générer les projets.', 400);
    }
    await CurrencyService.getCurrencyData();
    const { proposals, assessment } = await AiService.buildProposals({
      business: business.trim(),
      location: location.trim(),
      budget: CurrencyService.clampBudget(budget, currency),
      currency,
      refine: refine || '',
    });
    if (!proposals.length) {
      throw new AppError('Aucune proposition de projet générée. Réessayez.', 422);
    }
    return { proposals, assessment };
  },

  async startProject({ user, quoi, ou, budget, currency = 'EUR', title, report, sections }) {
    if (!user?.id) {
      throw new AppError('Authentification requise pour enregistrer le projet', 401);
    }

    if (!hasPaidAccess(user)) {
      throw new AppError('Un compte payant est requis pour poursuivre le parcours', 403);
    }

    await CurrencyService.getCurrencyData();

    let resolved;
    const alreadyResolved =
      quoi?.trim() && ou?.trim() && budget != null && budget !== '' && (report || (Array.isArray(sections) && sections.length));

    if (alreadyResolved) {
      // Projet déjà choisi via le parcours de recherche : on n'appelle pas
      // l'IA une seconde fois, on enregistre la proposition retenue telle quelle.
      resolved = {
        quoi: quoi.trim(),
        ou: ou.trim(),
        budget: CurrencyService.clampBudget(budget, currency),
        currency,
        source: 'ai',
        report: report || '',
        sections: Array.isArray(sections) ? sections : [],
      };
    } else {
      resolved = await AiService.completeProject({ quoi, ou, budget, currency });
    }

    if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
      throw new AppError('Impossible de compléter le projet', 422);
    }

    // Normalisation : on résout (ou crée) l'activité et le lieu partagés.
    const activity = await ActivityModel.findOrCreate({ label: resolved.quoi });
    const location = await LocationModel.findOrCreate({ label: resolved.ou });

    const project = await ProjectModel.create({
      userId: user.id,
      title: title?.trim() || resolved.quoi,
      activityId: activity.id,
      locationId: location.id,
      budget: resolved.budget,
      currency: resolved.currency,
      source: resolved.source,
      report: resolved.report || null,
      sections: resolved.sections || [],
    });

    return project;
  },

  async getUserProjects(userId) {
    return ProjectModel.findByUserId(userId);
  },

  async getUserProject(userId, projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project || project.userId !== userId) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  },

  async updateProject(userId, projectId, fields) {
    await this.getUserProject(userId, projectId);
    return ProjectModel.updateLifecycle(projectId, fields);
  },
};

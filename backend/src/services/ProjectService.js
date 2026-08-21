import { AppError } from '../utils/AppError.js';
import { hasPaidAccess } from '../constants/plans.js';
import { computeProjectProgress } from '../constants/projectStages.js';

export function createProjectService({
  projectRepository,
  activityRepository,
  locationRepository,
  aiService,
  currencyService,
  projectMemoryUpdateService = null,
  projectMemoryRecallService = null,
  projectMemoryScanService = null,
  projectTimelineService = null,
  projectStageRepository = null,
}) {
  async function withProgress(project) {
    if (!project) return project;
    let runs = [];
    if (projectStageRepository?.listRunsByProjectId) {
      try {
        runs = await projectStageRepository.listRunsByProjectId(project.id);
      } catch {
        runs = [];
      }
    }
    return { ...project, progress: computeProjectProgress(project, runs) };
  }

  /**
   * Charge un contexte mémoire pour enrichir les prompts IA.
   * Jamais sans utilisateur authentifié : projectId anonyme = IDOR.
   */
  async function resolveMemoryContext({
    userId = null,
    projectId = null,
    intent = '',
  } = {}) {
    if (!projectMemoryRecallService) return '';
    if (!userId) return '';
    try {
      let pid = projectId != null ? Number(projectId) : null;
      if (!pid) {
        const projects = await projectRepository.findByUserId(userId);
        pid = projects[0]?.id || null;
      }
      if (!pid) return '';

      const project = await projectRepository.findById(pid);
      if (!project || project.userId !== userId) return '';

      const ctx = await projectMemoryRecallService.buildRecallContext(pid, intent, {
        maxChars: 3500,
        limit: 14,
      });
      return ctx?.text || '';
    } catch (err) {
      console.warn('[memory] resolveMemoryContext:', err.message);
      return '';
    }
  }

  return {
    async previewProject({ quoi, ou, budget, currency = 'EUR', userId = null, projectId = null }) {
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Compl?ter / affiner le projet : ${quoi || ''} ${ou || ''}`.trim(),
      });
      const resolved = await aiService.completeProject({
        quoi,
        ou,
        budget,
        currency,
        memoryContext,
      });

      if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
        throw new AppError('Impossible de compl?ter le projet', 422);
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

    // --- Parcours de recherche en 3 phases (public, comme l'aper?u) ---

    async searchBusinesses({
      quoi,
      ou,
      budget,
      currency = 'EUR',
      refine,
      avoid,
      userId = null,
      projectId = null,
    }) {
      if (!quoi?.trim()) {
        throw new AppError("L'id?e est requise pour lancer la recherche.", 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche d'id?es business : ${quoi}`,
      });
      const businesses = await aiService.searchBusinesses({
        quoi: quoi.trim(),
        ou: ou?.trim() || '',
        budget: await currencyService.clampBudget(budget, currency),
        currency,
        refine: refine || '',
        avoid: Array.isArray(avoid) ? avoid : [],
        memoryContext,
      });
      if (!businesses.length) {
        throw new AppError('Aucune id?e de business g?n?r?e. R?essayez.', 422);
      }
      return businesses;
    },

    async searchTrainings({
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      quoi,
      ou,
      budget,
      currency = 'EUR',
      refine,
      avoid,
      userId = null,
      projectId = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('S?lectionnez un business pour demander une formation.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche de formations pour ${business}`,
      });
      const trainings = await aiService.searchTrainings({
        business: business.trim(),
        businessActivity: businessActivity || '',
        businessPitch: businessPitch || '',
        businessRationale: businessRationale || '',
        quoi: quoi || '',
        ou: ou?.trim() || '',
        budget: await currencyService.clampBudget(budget, currency),
        currency,
        refine: refine || '',
        avoid: Array.isArray(avoid) ? avoid : [],
        memoryContext,
      });
      if (!trainings.length) {
        throw new AppError('Aucune formation g?n?r?e. R?essayez.', 422);
      }
      return trainings;
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
      userId = null,
      projectId = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('S?lectionnez un business avant de chercher un lieu.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche de lieux pour ${business} pr?s de ${ou || ''}`,
      });
      const locations = await aiService.searchLocations({
        business: business.trim(),
        businessActivity: businessActivity || '',
        businessPitch: businessPitch || '',
        businessRationale: businessRationale || '',
        ou: ou?.trim() || '',
        budget: await currencyService.clampBudget(budget, currency),
        currency,
        refine: refine || '',
        avoid: Array.isArray(avoid) ? avoid : [],
        memoryContext,
      });
      if (!locations.length) {
        throw new AppError('Aucun lieu g?n?r?. R?essayez.', 422);
      }
      return locations;
    },

    async buildProposals({
      business,
      location,
      budget,
      currency = 'EUR',
      refine,
      userId = null,
      projectId = null,
    }) {
      if (!business?.trim() || !location?.trim()) {
        throw new AppError('Business et lieu sont requis pour g?n?rer les projets.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Propositions budget pour ${business} ? ${location}`,
      });
      const { proposals, assessment } = await aiService.buildProposals({
        business: business.trim(),
        location: location.trim(),
        budget: await currencyService.clampBudget(budget, currency),
        currency,
        refine: refine || '',
        memoryContext,
      });
      if (!proposals.length) {
        throw new AppError('Aucune proposition de projet g?n?r?e. R?essayez.', 422);
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

      await currencyService.getCurrencyData();

      let resolved;
      const alreadyResolved =
        quoi?.trim() && ou?.trim() && budget != null && budget !== '' && (report || (Array.isArray(sections) && sections.length));

      if (alreadyResolved) {
        // Projet d?j? choisi via le parcours de recherche : on n'appelle pas
        // l'IA une seconde fois, on enregistre la proposition retenue telle quelle.
        resolved = {
          quoi: quoi.trim(),
          ou: ou.trim(),
          budget: await currencyService.clampBudget(budget, currency),
          currency,
          source: 'ai',
          report: report || '',
          sections: Array.isArray(sections) ? sections : [],
        };
      } else {
        const memoryContext = await resolveMemoryContext({
          userId: user.id,
          intent: `Cr?ation projet : ${quoi || ''}`,
        });
        resolved = await aiService.completeProject({
          quoi,
          ou,
          budget,
          currency,
          memoryContext,
        });
      }

      if (!resolved.quoi || !resolved.ou || resolved.budget == null) {
        throw new AppError('Impossible de compl?ter le projet', 422);
      }

      // Normalisation : on r?sout (ou cr?e) l'activit? et le lieu partag?s.
      const activity = await activityRepository.findOrCreate({ label: resolved.quoi });
      const location = await locationRepository.findOrCreate({ label: resolved.ou });

      const project = await projectRepository.create({
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

      if (projectMemoryUpdateService) {
        const sectionBits = Array.isArray(resolved.sections)
          ? resolved.sections
              .slice(0, 6)
              .map((s) => (typeof s === 'string' ? s : s?.title || s?.label))
              .filter(Boolean)
              .join(' ? ')
          : '';
        projectMemoryUpdateService.recordEventSafe({
          projectId: project.id,
          nodeType: 'fact',
          content: [
            `Projet cr?? ? ${project.title || resolved.quoi} ?`,
            `activit? : ${resolved.quoi}`,
            `lieu : ${resolved.ou}`,
            resolved.budget != null
              ? `budget : ${resolved.budget} ${resolved.currency || 'EUR'}`
              : null,
            resolved.report
              ? `rapport : ${String(resolved.report).slice(0, 1200)}`
              : null,
            sectionBits ? `sections : ${sectionBits}` : null,
          ]
            .filter(Boolean)
            .join(' ? '),
          sourceEntityType: 'project',
          sourceEntityId: project.id,
          importance: 0.95,
          decayRate: 0.002,
        });
      }

      return project;
    },

    async getUserProjects(userId) {
      const projects = await projectRepository.findByUserId(userId);
      return Promise.all(projects.map((p) => withProgress(p)));
    },

    async getUserProject(userId, projectId) {
      const project = await projectRepository.findById(projectId);
      if (!project || project.userId !== userId) {
        throw new AppError('Projet introuvable', 404);
      }
      return withProgress(project);
    },

    async updateProject(userId, projectId, fields) {
      const before = await this.getUserProject(userId, projectId);
      const updated = await projectRepository.updateLifecycle(projectId, fields);

      if (projectMemoryUpdateService) {
        if (fields.status != null && fields.status !== before.status) {
          projectMemoryUpdateService.recordEventSafe({
            projectId,
            nodeType: 'event',
            content: `Statut projet : ${before.status} ? ${fields.status}`,
            sourceEntityType: 'project',
            sourceEntityId: projectId,
            importance: 0.7,
          });
        }
        if (fields.stage != null && fields.stage !== before.stage) {
          projectMemoryUpdateService.recordEventSafe({
            projectId,
            nodeType: 'decision',
            content: `?tape projet : ${before.stage} ? ${fields.stage}`,
            sourceEntityType: 'project',
            sourceEntityId: projectId,
            importance: 0.8,
          });
        }
      }

      return updated;
    },

    /**
     * R?sum? de situation via recall m?moire (projet de l'utilisateur).
     * Sans projectId : prend le projet le plus r?cent.
     */
    async getSituationSummary(userId, { projectId = null, intent = '' } = {}) {
      if (!projectMemoryRecallService) {
        throw new AppError('Service m?moire indisponible', 503);
      }

      let project;
      if (projectId) {
        project = await this.getUserProject(userId, projectId);
      } else {
        const projects = await this.getUserProjects(userId);
        project = projects[0] || null;
        if (!project) {
          throw new AppError(
            'Aucun projet pour l?instant. Cr?e ton avenir pour activer le r?sum? de situation.',
            404
          );
        }
      }

      const result = await projectMemoryRecallService.summarizeSituation(project.id, {
        intent: intent || undefined,
      });

      return {
        projectId: project.id,
        projectTitle: project.title || project.quoi || null,
        ...result,
      };
    },

    /**
     * Scan complet du projet + d?pendances ? m?moire cr??e / mise ? jour + snapshot.
     */
    async scanProjectMemory(userId, { projectId = null } = {}) {
      if (!projectMemoryScanService) {
        throw new AppError('Service de scan m?moire indisponible', 503);
      }

      let project;
      if (projectId) {
        project = await this.getUserProject(userId, projectId);
      } else {
        const projects = await this.getUserProjects(userId);
        project = projects[0] || null;
        if (!project) {
          throw new AppError(
            'Aucun projet pour l?instant. Cr?e ton avenir avant de synchroniser la m?moire.',
            404
          );
        }
      }

      return projectMemoryScanService.scanAndRebuild(project.id);
    },

    /**
     * Fil du temps agr?g? (actions, documents, IA?).
     */
    async getTimeline(userId, { projectId = null, limit = 200 } = {}) {
      if (!projectTimelineService) {
        throw new AppError('Service fil du temps indisponible', 503);
      }

      let project;
      if (projectId) {
        project = await this.getUserProject(userId, projectId);
      } else {
        const projects = await this.getUserProjects(userId);
        project = projects[0] || null;
        if (!project) {
          throw new AppError(
            'Aucun projet pour l?instant. Cr?e ton avenir pour voir le fil du temps.',
            404
          );
        }
      }

      return projectTimelineService.buildTimeline(project.id, { limit });
    },

    /**
     * Met ? jour / cr?e le lieu du projet (gestion g?ographique).
     */
    async updateProjectLocation(userId, projectId, fields = {}) {
      const project = await this.getUserProject(userId, projectId);
      const label = String(fields.label || fields.ou || project.ou || '').trim();
      if (!label) {
        throw new AppError('Le libell? du lieu est requis', 400);
      }

      const location = await locationRepository.findOrCreate({
        label,
        addressLine1: fields.addressLine1 ?? null,
        addressLine2: fields.addressLine2 ?? null,
        postalCode: fields.postalCode ?? null,
        city: fields.city ?? null,
        region: fields.region ?? null,
        department: fields.department ?? null,
        country: fields.country || 'FR',
        latitude: fields.latitude != null && fields.latitude !== '' ? Number(fields.latitude) : null,
        longitude:
          fields.longitude != null && fields.longitude !== '' ? Number(fields.longitude) : null,
      });

      // Enrichit le lieu existant (findOrCreate ne met ? jour que updated_at en conflit)
      const enriched = await locationRepository.update(location.id, {
        addressLine1: fields.addressLine1,
        addressLine2: fields.addressLine2,
        postalCode: fields.postalCode,
        city: fields.city,
        region: fields.region,
        department: fields.department,
        country: fields.country || 'FR',
        latitude: fields.latitude != null && fields.latitude !== '' ? Number(fields.latitude) : null,
        longitude:
          fields.longitude != null && fields.longitude !== '' ? Number(fields.longitude) : null,
      });

      const updated = await projectRepository.setLocationId(projectId, enriched.id || location.id);

      if (projectMemoryUpdateService) {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'fact',
          content: `Lieu projet mis ? jour : ${enriched.label || label}`
            + (enriched.city ? ` (${enriched.city})` : ''),
          sourceEntityType: 'location',
          sourceEntityId: enriched.id,
          importance: 0.65,
        });
      }

      return withProgress(updated);
    },
  };
}

import { AppError } from '../utils/AppError.js';
import { hasPaidAccess } from '../constants/plans.js';
import { computeProjectProgress } from '../constants/projectStages.js';
import { withAiUsageContext } from '../utils/aiUsage.js';
import { createAdvancementCoachService } from './AdvancementCoachService.js';
import pool from '../database/pool.js';

const LOCATION_SUGGEST_TIMEOUT_MS = 4500;

async function fetchLocationSuggestions(query, { countrycodes = '' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCATION_SUGGEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
      'accept-language': 'fr',
    });
    const cc = String(countrycodes || '').trim().toLowerCase();
    if (/^[a-z]{2}(,[a-z]{2}){0,4}$/.test(cc)) {
      params.set('countrycodes', cc);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Kizumai/1.0 (location suggestions)',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function formatLocationSuggestion(item) {
  const address = item?.address || {};
  const suburb =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.district ||
    '';
  const city = address.city || address.town || address.village || address.municipality || '';
  const region = address.state || address.region || address.county || '';
  const country = address.country || '';
  const labelParts = [
    suburb && suburb !== city ? suburb : null,
    city,
    region,
    country,
  ].filter(Boolean);
  const uniqueParts = labelParts.filter(
    (part, index) => labelParts.indexOf(part) === index
  );
  const label = uniqueParts.length
    ? uniqueParts.slice(0, 3).join(', ')
    : String(item?.display_name || '').split(',').slice(0, 3).join(',').trim();

  return {
    label,
    displayName: String(item?.display_name || label),
    city: city || suburb,
    region,
    country,
    latitude: item?.lat != null ? Number(item.lat) : null,
    longitude: item?.lon != null ? Number(item.lon) : null,
    source: 'nominatim',
  };
}

function formatDbLocationSuggestion(location) {
  const label = [location.label, location.city, location.region, location.country]
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index)
    .slice(0, 3)
    .join(', ');

  return {
    label: label || location.label,
    displayName: location.label,
    city: location.city || null,
    region: location.region || null,
    country: location.country || null,
    latitude: location.latitude,
    longitude: location.longitude,
    source: 'database',
  };
}

function dedupeLocationSuggestions(locations) {
  const seen = new Set();
  return locations.filter((location) => {
    if (!location?.label) return false;
    const key = location.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createProjectService({
  projectRepository,
  activityRepository,
  locationRepository,
  aiService,
  currencyService,
  settingsService = null,
  projectMemoryUpdateService = null,
  projectMemoryRecallService = null,
  projectMemoryScanService = null,
  projectTimelineService = null,
  projectStageRepository = null,
  documentRepository = null,
  storageService = null,
}) {
  const advancementCoach = createAdvancementCoachService({
    projectMemoryRecallService,
  });

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
   * Charge un contexte m�moire pour enrichir les prompts IA.
   * Jamais sans utilisateur authentifi� : projectId anonyme = IDOR.
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
    async suggestLocations({ q, countrycodes = '' }) {
      const query = q?.trim() || '';
      if (query.length < 2) return [];

      const dbRows = locationRepository?.searchByLabel
        ? await locationRepository.searchByLabel(query, { limit: 6 }).catch(() => [])
        : [];

      let rows = await fetchLocationSuggestions(query, { countrycodes });
      if (!rows.length && countrycodes) {
        rows = await fetchLocationSuggestions(query, { countrycodes: '' });
      }

      return dedupeLocationSuggestions([
        ...dbRows.map(formatDbLocationSuggestion),
        ...rows.map(formatLocationSuggestion),
      ]).slice(0, 8);
    },

    async previewProject({ quoi, ou, budget, currency = 'EUR', userId = null, projectId = null }) {
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Compl?ter / affiner le projet : ${quoi || ''} ${ou || ''}`.trim(),
      });
      const resolved = await withAiUsageContext(
        { userId, projectId, purpose: 'complete_project' },
        () =>
          aiService.completeProject({
            quoi,
            ou,
            budget,
            currency,
            memoryContext,
          })
      );

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
      temperature = null,
    }) {
      const normalizedQuoi = quoi?.trim() || '';
      const normalizedOu = ou?.trim() || '';
      if (!normalizedQuoi && !normalizedOu) {
        throw new AppError("Une idée ou un lieu est requis pour lancer la recherche.", 400);
      }
      await currencyService.getCurrencyData();
      const businessConfig = settingsService
        ? await settingsService.getBusinessConfig()
        : { projectSuggestionsCount: 3 };
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche d'idées business : ${normalizedQuoi} ${normalizedOu}`.trim(),
      });
      const clampedBudget = await currencyService.clampBudget(budget, currency);
      const businesses = await withAiUsageContext(
        { userId, projectId, purpose: 'search_businesses' },
        () =>
          aiService.searchBusinesses({
            quoi: normalizedQuoi,
            ou: normalizedOu,
            budget: clampedBudget,
            currency,
            refine: refine || '',
            avoid: Array.isArray(avoid) ? avoid : [],
            count: businessConfig.projectSuggestionsCount,
            memoryContext,
            temperature,
          })
      );
      if (!businesses.length) {
        throw new AppError('Aucune idée de business générée. Réessayez.', 422);
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
      temperature = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('Sélectionnez un business pour demander une formation.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche de formations pour ${business}`,
      });
      const trainings = await withAiUsageContext(
        { userId, projectId, purpose: 'search_trainings' },
        async () =>
          aiService.searchTrainings({
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
            temperature,
          })
      );
      if (!trainings.length) {
        throw new AppError('Aucune formation générée. Réessayez.', 422);
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
      temperature = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('Sélectionnez un business avant de chercher un lieu.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Recherche de lieux pour ${business} près de ${ou || ''}`,
      });
      const locations = await withAiUsageContext(
        { userId, projectId, purpose: 'search_locations' },
        async () =>
          aiService.searchLocations({
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
            temperature,
          })
      );
      if (!locations.length) {
        throw new AppError('Aucun lieu généré. Réessayez.', 422);
      }
      return locations;
    },

    async evaluateFranceImplantation({
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      budget,
      currency = 'EUR',
      userId = null,
      projectId = null,
      temperature = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('Sélectionnez un business pour évaluer les régions.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Carte d'implantation France pour ${business}`,
      });
      return withAiUsageContext({ userId, projectId, purpose: 'france_implantation' }, async () =>
        aiService.evaluateFranceImplantation({
          business: business.trim(),
          businessActivity: businessActivity || '',
          businessPitch: businessPitch || '',
          businessRationale: businessRationale || '',
          budget: await currencyService.clampBudget(budget, currency),
          currency,
          memoryContext,
          temperature,
        })
      );
    },

    async evaluateCityImplantation({
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      city,
      region,
      budget,
      currency = 'EUR',
      userId = null,
      projectId = null,
      temperature = null,
    }) {
      if (!business?.trim()) {
        throw new AppError('Sélectionnez un business pour évaluer une ville.', 400);
      }
      if (!city?.trim()) {
        throw new AppError('Indiquez une ville à évaluer.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Évaluation implantation ${business} à ${city}`,
      });
      return withAiUsageContext({ userId, projectId, purpose: 'city_implantation' }, async () =>
        aiService.evaluateCityImplantation({
          business: business.trim(),
          businessActivity: businessActivity || '',
          businessPitch: businessPitch || '',
          businessRationale: businessRationale || '',
          city: city.trim(),
          region: region || '',
          budget: await currencyService.clampBudget(budget, currency),
          currency,
          memoryContext,
          temperature,
        })
      );
    },

    async buildProposals({
      business,
      location,
      budget,
      currency = 'EUR',
      refine,
      userId = null,
      projectId = null,
      temperature = null,
    }) {
      if (!business?.trim() || !location?.trim()) {
        throw new AppError('Business et lieu sont requis pour générer les projets.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Propositions budget pour ${business} à ${location}`,
      });
      const { proposals, assessment } = await withAiUsageContext(
        { userId, projectId, purpose: 'build_proposals' },
        async () =>
          aiService.buildProposals({
            business: business.trim(),
            location: location.trim(),
            budget: await currencyService.clampBudget(budget, currency),
            currency,
            refine: refine || '',
            memoryContext,
            temperature,
          })
      );
      if (!proposals.length) {
        throw new AppError('Aucune proposition de projet générée. Réessayez.', 422);
      }
      return { proposals, assessment };
    },

    async analyzeProjectPreview({
      title = '',
      business,
      location,
      budget,
      currency = 'EUR',
      report = '',
      sections = [],
      training = null,
      feasibility = null,
      userId = null,
      projectId = null,
      temperature = null,
    }) {
      if (!business?.trim() || !location?.trim()) {
        throw new AppError('Business et lieu sont requis pour l’analyse.', 400);
      }
      await currencyService.getCurrencyData();
      const memoryContext = await resolveMemoryContext({
        userId,
        projectId,
        intent: `Analyse aperçu : ${business} à ${location}`,
      });
      return withAiUsageContext(
        { userId, projectId, purpose: 'project_preview_analysis' },
        async () =>
          aiService.analyzeProjectPreview({
            title,
            business: business.trim(),
            location: location.trim(),
            budget: await currencyService.clampBudget(budget, currency),
            currency,
            report,
            sections,
            training,
            feasibility,
            memoryContext,
            temperature,
          })
      );
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
        resolved = await withAiUsageContext(
          { userId: user.id, purpose: 'complete_project' },
          () =>
            aiService.completeProject({
              quoi,
              ou,
              budget,
              currency,
              memoryContext,
            })
        );
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

    /**
     * Suppression définitive d’un projet + mémoire IA + données liées.
     * Le compte payant est conservé ; l’utilisateur peut recommencer via « Créer son avenir ».
     */
    async deleteProject(userId, projectId, { confirm = false } = {}) {
      if (!confirm) {
        throw new AppError(
          'Confirmation requise pour supprimer définitivement le projet',
          400
        );
      }

      const project = await this.getUserProject(userId, projectId);
      const pid = Number(project.id);

      // Fichiers sur disque avant cascade SQL documents.
      if (documentRepository?.findByProjectId) {
        const docs = await documentRepository.findByProjectId(pid);
        if (storageService?.remove) {
          await Promise.allSettled(
            (docs || [])
              .map((d) => d.storageKey)
              .filter(Boolean)
              .map((key) => storageService.remove(key))
          );
        }
      }

      // Tables en ON DELETE SET NULL : purge explicite pour un vrai « recommencer à zéro ».
      await pool.query('DELETE FROM planner_events WHERE project_id = $1', [pid]);
      await pool.query('DELETE FROM learning_records WHERE project_id = $1', [pid]);
      await pool.query('DELETE FROM contacts WHERE project_id = $1', [pid]);

      // CASCADE : stages, documents, scans, companies, mémoire (nodes/edges/snapshots).
      const deleted = await projectRepository.delete(pid);
      if (!deleted) {
        throw new AppError('Projet introuvable', 404);
      }

      return {
        deleted: true,
        projectId: pid,
        title: project.title || project.quoi || null,
      };
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
     * Coach d’avancement (mémoire + IA), rail = étape parcours.
     */
    async getAdvancementCoach(userId, { projectId = null } = {}) {
      let project;
      if (projectId) {
        project = await this.getUserProject(userId, projectId);
      } else {
        const projects = await this.getUserProjects(userId);
        project = projects[0] || null;
        if (!project) {
          throw new AppError(
            'Aucun projet pour l’instant. Crée ton avenir pour activer le coach d’avancement.',
            404
          );
        }
      }

      const coach = await advancementCoach.buildForProject(project);
      return {
        ...coach,
        projectTitle: project.title || project.quoi || null,
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

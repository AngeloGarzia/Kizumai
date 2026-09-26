import { AppError } from '../utils/AppError.js';
import { withAiUsageContext } from '../utils/aiUsage.js';

const FIELD_LABELS = {
  business: 'Business / activité',
  location: 'Lieu',
  budget: 'Budget',
  title: 'Titre',
  description: 'Description',
};

const FIELD_KEYS = new Set(Object.keys(FIELD_LABELS));
const PRIORITIES = new Set(['high', 'medium', 'low']);

function clip(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function valuesDiffer(a, b) {
  const left = String(a ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const right = String(b ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!right) return false;
  return left !== right;
}

/**
 * Analyse l'état complet du projet après nouveaux ajouts en base,
 * propose des réorientations (business / lieu / budget…) à valider.
 */
export function createProjectReorientationService({
  projectReviewRepository,
  projectRepository,
  documentRepository,
  documentScanRepository = null,
  companyRepository = null,
  activityRepository,
  locationRepository,
  currencyService,
  aiService,
  projectMemoryScanService = null,
  projectMemorySnapshotRepository = null,
  projectMemoryRecallService = null,
  projectMemoryUpdateService = null,
}) {
  const debounceTimers = new Map();
  const running = new Set();

  async function hydrate(review) {
    const items = await projectReviewRepository.listItems(review.id);
    return { review, items };
  }

  async function assertOwner(userId, projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || Number(project.userId) !== Number(userId)) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  async function buildContext(project) {
    const projectId = project.id;
    const [snapshot, docs, company] = await Promise.all([
      projectMemorySnapshotRepository?.findByProjectId?.(projectId),
      documentRepository.findByProjectId(projectId),
      companyRepository?.findByProjectId?.(projectId),
    ]);

    let memoryText = '';
    if (snapshot?.summary) {
      memoryText = [
        snapshot.summary,
        Array.isArray(snapshot.keyFacts) && snapshot.keyFacts.length
          ? `Faits clés : ${snapshot.keyFacts.slice(0, 12).join(' · ')}`
          : null,
        Array.isArray(snapshot.activeBlockers) && snapshot.activeBlockers.length
          ? `Blocages : ${snapshot.activeBlockers.slice(0, 8).join(' · ')}`
          : null,
        Array.isArray(snapshot.nextActions) && snapshot.nextActions.length
          ? `Actions : ${snapshot.nextActions.slice(0, 8).join(' · ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
    } else if (projectMemoryRecallService?.buildRecallContext) {
      try {
        const ctx = await projectMemoryRecallService.buildRecallContext(
          projectId,
          'Analyse de réorientation du projet',
          { maxChars: 4000, limit: 16 }
        );
        memoryText = ctx?.text || '';
      } catch {
        memoryText = '';
      }
    }

    const docLines = [];
    for (const doc of (docs || []).slice(0, 12)) {
      const label = doc.title || doc.fileName || `Document #${doc.id}`;
      let summary = clip(doc.excerpt || doc.description || '', 600);
      if (documentScanRepository?.findLatestForDocument) {
        try {
          const scan = await documentScanRepository.findLatestForDocument(doc.id);
          if (scan?.status === 'ready' && documentScanRepository.listItems) {
            const items = await documentScanRepository.listItems(scan.id);
            const acceptedSummary = items.find(
              (i) => i.itemType === 'summary' && i.status === 'accepted'
            );
            if (acceptedSummary?.payload?.text) {
              summary = clip(acceptedSummary.payload.text, 1200);
            }
          }
        } catch {
          /* ignore */
        }
      }
      docLines.push(`- ${label}${summary ? ` : ${summary}` : ''}`);
    }

    const companyText = company
      ? [company.legalName || company.tradeName, company.legalForm, company.lifecycleState]
          .filter(Boolean)
          .join(' · ')
      : 'aucune';

    return {
      title: project.title || '',
      business: project.quoi || project.activity?.label || '',
      location: project.ou || project.location?.label || '',
      budget: project.budget != null ? String(project.budget) : '',
      currency: project.currency || 'EUR',
      status: project.status || '',
      stage: project.stage || '',
      description: project.description || '',
      company: companyText,
      memorySnapshot: memoryText || 'aucune mémoire consolidée',
      documents: docLines.length ? docLines.join('\n') : 'aucun document',
      extras: [
        project.legalForm ? `Forme juridique projet : ${project.legalForm}` : null,
        `Nb documents : ${(docs || []).length}`,
      ]
        .filter(Boolean)
        .join('\n') || '—',
    };
  }

  function buildItemsFromAi(result, project) {
    const items = [];
    const current = {
      business: project.quoi || project.activity?.label || '',
      location: project.ou || project.location?.label || '',
      budget: project.budget != null ? String(Math.round(Number(project.budget))) : '',
      title: project.title || '',
      description: project.description || '',
    };

    for (const p of result.proposals || []) {
      const field = String(p.field || '').trim().toLowerCase();
      if (!FIELD_KEYS.has(field)) continue;
      let proposed = clip(p.proposedValue ?? p.value, field === 'description' ? 4000 : 500);
      if (!proposed) continue;
      if (field === 'budget') {
        const n = Number(String(proposed).replace(/[^\d.-]/g, ''));
        if (!Number.isFinite(n) || n <= 0) continue;
        proposed = String(Math.round(n));
      }
      const currentValue = current[field] || clip(p.currentValue, 500) || '';
      if (!valuesDiffer(currentValue, proposed)) continue;

      items.push({
        fieldKey: field,
        confidence: normalizeConfidence(p.confidence),
        priority: PRIORITIES.has(p.priority) ? p.priority : 'medium',
        label: FIELD_LABELS[field],
        currentValue: currentValue || null,
        proposedValue: proposed,
        rationale: clip(p.rationale, 1200),
        payload: {},
      });
    }

    const order = { high: 0, medium: 1, low: 2 };
    items.sort(
      (a, b) =>
        (order[a.priority] ?? 9) - (order[b.priority] ?? 9) ||
        a.fieldKey.localeCompare(b.fieldKey)
    );
    return items.map((item, idx) => ({ ...item, sortOrder: idx }));
  }

  async function processReview(reviewId) {
    if (running.has(reviewId)) return null;
    running.add(reviewId);
    try {
      const review = await projectReviewRepository.findById(reviewId);
      if (!review || ['ready', 'dismissed', 'applied'].includes(review.status)) {
        return review ? hydrate(review) : null;
      }

      await projectReviewRepository.update(reviewId, {
        status: 'processing',
        startedAt: new Date().toISOString(),
        errorMessage: null,
      });

      const project = await projectRepository.findById(review.projectId);
      if (!project) {
        await projectReviewRepository.update(reviewId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          errorMessage: 'Projet introuvable',
        });
        return hydrate(await projectReviewRepository.findById(reviewId));
      }

      if (projectMemoryScanService?.scanAndRebuild) {
        try {
          await projectMemoryScanService.scanAndRebuild(project.id);
        } catch (err) {
          console.warn('[reorientation] memory rebuild:', err.message);
        }
      }

      const context = await buildContext(project);
      const result = await withAiUsageContext(
        {
          userId: review.userId,
          projectId: project.id,
          purpose: 'project_reorientation',
        },
        () =>
          aiService.analyzeProjectReorientation({
            ...context,
            trigger: `${review.triggerSource}${
              review.triggerRefId ? `#${review.triggerRefId}` : ''
            }`,
          })
      );

      const items = buildItemsFromAi(result, project);
      await projectReviewRepository.deleteItems(reviewId);
      await projectReviewRepository.createItems(reviewId, items);
      await projectReviewRepository.update(reviewId, {
        status: 'ready',
        situation: result.situation || null,
        provider: result.provider || null,
        rawResponse: result.raw || {},
        finishedAt: new Date().toISOString(),
        errorMessage: null,
      });

      return hydrate(await projectReviewRepository.findById(reviewId));
    } catch (err) {
      await projectReviewRepository.update(reviewId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: err.message || 'Analyse impossible',
      });
      console.warn('[reorientation] process:', err.message);
      return hydrate(await projectReviewRepository.findById(reviewId));
    } finally {
      running.delete(reviewId);
    }
  }

  return {
    async enqueueReview({
      userId,
      projectId,
      triggerSource = 'manual',
      triggerRefId = null,
      force = false,
    }) {
      const project = await assertOwner(userId, projectId);
      const active = await projectReviewRepository.findActiveForProject(project.id);
      if (active && !force) {
        if (active.status === 'ready') return hydrate(active);
        if (['pending', 'processing'].includes(active.status)) {
          return hydrate(active);
        }
      }
      if (active && force && ['pending', 'processing'].includes(active.status)) {
        return hydrate(active);
      }

      const review = await projectReviewRepository.create({
        projectId: project.id,
        userId,
        triggerSource,
        triggerRefId,
      });

      setImmediate(() => {
        processReview(review.id).catch((err) => {
          console.warn('[reorientation] enqueue:', err.message);
        });
      });

      return hydrate(review);
    },

    /** Debounce : coalesce plusieurs ajouts mémoire en une analyse. */
    scheduleReview(projectId, { userId, triggerSource = 'memory_event', delayMs = 45_000 } = {}) {
      const id = Number(projectId);
      if (!id) return;
      const prev = debounceTimers.get(id);
      if (prev) clearTimeout(prev);
      debounceTimers.set(
        id,
        setTimeout(() => {
          debounceTimers.delete(id);
          (async () => {
            try {
              const project = await projectRepository.findById(id);
              if (!project) return;
              const uid = userId || project.userId;
              await this.enqueueReview({
                userId: uid,
                projectId: id,
                triggerSource,
              });
            } catch (err) {
              console.warn('[reorientation] schedule:', err.message);
            }
          })();
        }, delayMs)
      );
    },

    enqueueReviewSafe(payload) {
      this.enqueueReview(payload).catch((err) => {
        console.warn('[reorientation] enqueueSafe:', err.message);
      });
    },

    async getReview(userId, projectId, reviewId) {
      await assertOwner(userId, projectId);
      const review = await projectReviewRepository.findById(reviewId);
      if (!review || Number(review.projectId) !== Number(projectId)) {
        throw new AppError('Revue introuvable', 404);
      }
      return hydrate(review);
    },

    async getLatest(userId, projectId) {
      await assertOwner(userId, projectId);
      const review = await projectReviewRepository.findLatestForProject(projectId, {
        statuses: ['pending', 'processing', 'ready', 'failed'],
      });
      if (!review) return null;
      return hydrate(review);
    },

    async applyReview(userId, projectId, reviewId, { acceptItemIds = [], rejectItemIds = [] }) {
      await assertOwner(userId, projectId);
      const review = await projectReviewRepository.findById(reviewId);
      if (!review || Number(review.projectId) !== Number(projectId)) {
        throw new AppError('Revue introuvable', 404);
      }
      if (review.status !== 'ready') {
        throw new AppError("La revue n'est pas prête", 400);
      }

      const acceptIds = [...new Set(acceptItemIds.map(Number).filter(Boolean))];
      const rejectIds = [...new Set(rejectItemIds.map(Number).filter(Boolean))];

      for (const id of rejectIds) {
        const items = await projectReviewRepository.findItemsByIds(reviewId, [id]);
        if (items[0]?.status === 'suggested') {
          await projectReviewRepository.updateItem(id, { status: 'rejected' });
        }
      }

      const toAccept = await projectReviewRepository.findItemsByIds(reviewId, acceptIds);
      let project = await projectRepository.findById(projectId);

      for (const item of toAccept) {
        if (item.status !== 'suggested') continue;
        const value = clip(item.proposedValue, 4000);
        if (!value) continue;

        if (item.fieldKey === 'business') {
          const activity = await activityRepository.findOrCreate({ label: value });
          project = await projectRepository.setActivityId(projectId, activity.id);
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Business réorienté : ${value}${
                item.rationale ? ` — ${item.rationale}` : ''
              }`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.85,
            });
          }
        }

        if (item.fieldKey === 'location') {
          const location = await locationRepository.findOrCreate({
            label: value,
            country: 'FR',
          });
          project = await projectRepository.setLocationId(projectId, location.id);
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Lieu réorienté : ${value}${
                item.rationale ? ` — ${item.rationale}` : ''
              }`,
              sourceEntityType: 'location',
              sourceEntityId: location.id,
              importance: 0.82,
            });
          }
        }

        if (item.fieldKey === 'budget') {
          const currency = project.currency || 'EUR';
          const clamped = await currencyService.clampBudget(Number(value), currency);
          project = await projectRepository.setBudget(projectId, clamped, currency);
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Budget réorienté : ${clamped} ${currency}${
                item.rationale ? ` — ${item.rationale}` : ''
              }`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.82,
            });
          }
        }

        if (item.fieldKey === 'title') {
          project = await projectRepository.updateLifecycle(projectId, { title: value });
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Titre projet mis à jour : ${value}`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.7,
            });
          }
        }

        if (item.fieldKey === 'description') {
          project = await projectRepository.updateLifecycle(projectId, {
            description: value,
          });
          if (projectMemoryUpdateService) {
            projectMemoryUpdateService.recordEventSafe({
              projectId,
              nodeType: 'decision',
              content: `Description projet mise à jour : ${clip(value, 500)}`,
              sourceEntityType: 'project',
              sourceEntityId: projectId,
              importance: 0.68,
            });
          }
        }

        await projectReviewRepository.updateItem(item.id, { status: 'accepted' });
      }

      await projectReviewRepository.update(reviewId, { status: 'applied' });
      return {
        ...(await hydrate(await projectReviewRepository.findById(reviewId))),
        project,
      };
    },

    async dismissReview(userId, projectId, reviewId) {
      await assertOwner(userId, projectId);
      const review = await projectReviewRepository.findById(reviewId);
      if (!review || Number(review.projectId) !== Number(projectId)) {
        throw new AppError('Revue introuvable', 404);
      }
      await projectReviewRepository.update(reviewId, { status: 'dismissed' });
      return hydrate(await projectReviewRepository.findById(reviewId));
    },

    processReview,
  };
}

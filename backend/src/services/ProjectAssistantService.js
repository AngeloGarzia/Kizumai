import { AppError } from '../utils/AppError.js';
import { withAiUsageContext } from '../utils/aiUsage.js';
import { collectAllSignals } from './collectors/assistantCollectors.js';

function clip(value, max) {
  if (value == null) return '';
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (3600 * 1000);
}

/**
 * Assistant Fabulous périodique : règles + IA conditionnelle + insights.
 */
export function createProjectAssistantService({
  projectAssistantRepository,
  projectRepository,
  plannerEventRepository,
  documentRepository,
  documentScanRepository = null,
  projectStageRepository,
  projectMemorySnapshotRepository,
  aiService,
  settingsService = null,
  notificationService = null,
  projectReorientationService = null,
}) {
  async function assistantConfig() {
    const s = settingsService
      ? await settingsService.getAssistantConfig?.().catch(() => null)
      : null;
    if (s) return s;
    return {
      enabled: true,
      checkupCron: '0 */2 * * *',
      aiMinIntervalHours: 24,
      stagnationDays: 7,
      activeWithinDays: 30,
      eventThreshold: 8,
      maxAgeHours: 24,
    };
  }

  let notificationServiceRef = notificationService;

  async function buildAiContext(project, signals) {
    const snap = await projectMemorySnapshotRepository.findByProjectId(project.id);
    const events = await plannerEventRepository.findByProjectId(project.id);
    const docs = await documentRepository.findByProjectId(project.id);

    const plannerLines = (events || [])
      .filter((e) => ['todo', 'in_progress'].includes(e.status))
      .slice(0, 12)
      .map(
        (e) =>
          `- [${e.kind}] ${e.title} @ ${e.startAt ? String(e.startAt).slice(0, 16) : '?'}`
      );

    const docLines = (docs || [])
      .slice(0, 12)
      .map((d) => `- ${d.title || d.fileName}`);

    return {
      title: project.title || '',
      business: project.quoi || project.activity?.label || '',
      location: project.ou || project.location?.label || '',
      budget: project.budget != null ? String(project.budget) : '',
      currency: project.currency || 'EUR',
      stage: project.stage || '',
      status: project.status || '',
      description: clip(project.description, 2000) || 'aucune',
      memorySnapshot: snap?.summary
        ? [
            snap.summary,
            Array.isArray(snap.keyFacts) && snap.keyFacts.length
              ? `Faits : ${snap.keyFacts.slice(0, 10).join(' · ')}`
              : null,
            Array.isArray(snap.activeBlockers) && snap.activeBlockers.length
              ? `Blocages : ${snap.activeBlockers.slice(0, 6).join(' · ')}`
              : null,
          ]
            .filter(Boolean)
            .join('\n')
        : 'aucune',
      signals: signals
        .slice(0, 20)
        .map((s) => `- [${s.priority}] ${s.kind}: ${s.title}`)
        .join('\n') || 'aucun',
      planner: plannerLines.join('\n') || 'aucune',
      documents: docLines.join('\n') || 'aucun',
    };
  }

  async function persistSignals(projectId, runId, signals) {
    const saved = [];
    for (const signal of signals) {
      const row = await projectAssistantRepository.upsertInsight({
        projectId,
        runId,
        kind: signal.kind,
        priority: signal.priority || 'medium',
        title: clip(signal.title, 255),
        body: clip(signal.body, 2000) || null,
        payload: signal.payload || {},
        dedupeKey: signal.dedupeKey,
      });
      if (row) saved.push(row);
    }
    return saved;
  }

  async function notifyHigh(project, insights) {
    if (!notificationServiceRef?.notifyUser) return;
    const freshHigh = insights.filter(
      (i) => i.priority === 'high' && i.status === 'open' && !i.notifiedAt
    );
    if (!freshHigh.length) return;

    const top = freshHigh[0];
    try {
      await notificationService.notifyUser(project.userId, {
        title: `Fabulous : ${top.title}`,
        body: clip(top.body || 'Nouveau point d’attention sur votre projet.', 280),
        url: top.payload?.url || '/',
      });
      await projectAssistantRepository.markNotified(freshHigh.map((i) => i.id));
    } catch (err) {
      console.warn('[assistant] notify:', err.message);
    }
  }

  return {
    setNotificationService(service) {
      notificationServiceRef = service || null;
    },

    async runCheckup(projectId) {
      const cfg = await assistantConfig();
      if (!cfg.enabled) return { skipped: 'disabled' };

      const project = await projectRepository.findById(projectId);
      if (!project) return { skipped: 'not_found' };
      if (['archived', 'launched'].includes(project.status)) {
        return { skipped: 'inactive_status' };
      }

      if (await projectAssistantRepository.hasProcessingRun(projectId)) {
        return { skipped: 'already_processing' };
      }

      const run = await projectAssistantRepository.createRun(projectId);
      try {
        const memoryCfg = settingsService
          ? await settingsService.getMemoryConfig().catch(() => ({}))
          : {};

        const signals = await collectAllSignals({
          plannerEventRepository,
          documentRepository,
          documentScanRepository,
          projectStageRepository,
          projectMemorySnapshotRepository,
          project,
          projectId: project.id,
          stagnationDays: cfg.stagnationDays,
          eventThreshold: memoryCfg.snapshotEventThreshold || 8,
          maxAgeHours: memoryCfg.snapshotMaxAgeHours || 24,
        });

        const ruleInsights = await persistSignals(project.id, run.id, signals);
        const hasHigh = signals.some((s) => s.priority === 'high');
        const lastAi = await projectAssistantRepository.findLatestAiRun(project.id);
        const aiDue =
          hoursSince(lastAi?.finishedAt) >= (cfg.aiMinIntervalHours || 24);

        let aiUsed = false;
        let provider = null;
        let raw = {};
        let aiInsights = [];

        if ((signals.length > 0 || aiDue) && (hasHigh || aiDue || signals.length >= 2)) {
          try {
            const ctx = await buildAiContext(project, signals);
            const result = await withAiUsageContext(
              {
                userId: project.userId,
                projectId: project.id,
                purpose: 'project_assistant',
              },
              () => aiService.analyzeProjectAssistant(ctx)
            );
            aiUsed = true;
            provider = result.provider || null;
            raw = result.raw || {};

            if (result.reflection) {
              const reflection = await projectAssistantRepository.upsertInsight({
                projectId: project.id,
                runId: run.id,
                kind: 'reflection',
                priority: 'low',
                title: 'Réflexion Fabulous',
                body: clip(result.reflection, 2500),
                payload: { url: '/' },
                dedupeKey: `reflection-${new Date().toISOString().slice(0, 10)}`,
              });
              if (reflection) aiInsights.push(reflection);
            }

            for (const item of result.insights || []) {
              const kind = [
                'reflection',
                'action',
                'reorientation',
                'deadline',
                'missing_document',
                'stagnation',
                'scan_pending',
              ].includes(item.kind)
                ? item.kind
                : 'action';
              const row = await projectAssistantRepository.upsertInsight({
                projectId: project.id,
                runId: run.id,
                kind,
                priority: ['high', 'medium', 'low'].includes(item.priority)
                  ? item.priority
                  : 'medium',
                title: clip(item.title || 'Suggestion Fabulous', 255),
                body: clip(item.body, 2000) || null,
                payload: {
                  url: item.urlHint || '/',
                  fromAi: true,
                },
                dedupeKey: `ai-${kind}-${clip(item.title, 80)
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`,
              });
              if (row) aiInsights.push(row);
            }

            if (
              projectReorientationService &&
              Array.isArray(result.reorientationSuggestions) &&
              result.reorientationSuggestions.length
            ) {
              const review = await projectReorientationService.enqueueReview({
                userId: project.userId,
                projectId: project.id,
                triggerSource: 'assistant',
              });
              await projectAssistantRepository.upsertInsight({
                projectId: project.id,
                runId: run.id,
                kind: 'reorientation',
                priority: 'medium',
                title: 'Réorientation proposée',
                body: 'Fabulous suggère d’ajuster business, lieu ou budget — à valider.',
                payload: {
                  url: '/',
                  reviewId: review?.review?.id ?? null,
                  suggestions: result.reorientationSuggestions.slice(0, 6),
                },
                dedupeKey: `reorient-review-${review?.review?.id || 'pending'}`,
              });
            }
          } catch (err) {
            console.warn(`[assistant] IA projet #${projectId}:`, err.message);
          }
        }

        await projectAssistantRepository.updateRun(run.id, {
          status: 'ready',
          signalsCount: signals.length,
          aiUsed,
          provider,
          rawResponse: raw,
          finishedAt: new Date().toISOString(),
        });

        const allOpen = await projectAssistantRepository.listOpenByProject(project.id);
        await notifyHigh(project, allOpen);

        return {
          runId: run.id,
          signals: signals.length,
          aiUsed,
          insights: ruleInsights.length + aiInsights.length,
        };
      } catch (err) {
        await projectAssistantRepository.updateRun(run.id, {
          status: 'failed',
          errorMessage: err.message || 'Checkup échoué',
          finishedAt: new Date().toISOString(),
        });
        throw err;
      }
    },

    async enqueueEligibleCheckups() {
      const cfg = await assistantConfig();
      if (!cfg.enabled) return { enqueued: 0 };
      const projects = await projectRepository.findEligibleForAssistant({
        withinDays: cfg.activeWithinDays,
      });
      return { projects: projects.map((p) => p.id) };
    },

    async listInsights(userId, projectId) {
      const project = await projectRepository.findById(projectId);
      if (!project || Number(project.userId) !== Number(userId)) {
        throw new AppError('Projet introuvable', 404);
      }
      const insights = await projectAssistantRepository.listOpenByProject(projectId);
      const openCount = await projectAssistantRepository.countOpenByProject(projectId);
      return { insights, openCount };
    },

    async updateInsight(userId, projectId, insightId, status) {
      if (!['read', 'dismissed', 'acted', 'open'].includes(status)) {
        throw new AppError('Statut invalide', 400);
      }
      const project = await projectRepository.findById(projectId);
      if (!project || Number(project.userId) !== Number(userId)) {
        throw new AppError('Projet introuvable', 404);
      }
      const insight = await projectAssistantRepository.findInsight(projectId, insightId);
      if (!insight) throw new AppError('Insight introuvable', 404);
      return projectAssistantRepository.updateInsightStatus(insightId, status);
    },

    async requestCheckup(userId, projectId) {
      const project = await projectRepository.findById(projectId);
      if (!project || Number(project.userId) !== Number(userId)) {
        throw new AppError('Projet introuvable', 404);
      }
      return this.runCheckup(projectId);
    },
  };
}

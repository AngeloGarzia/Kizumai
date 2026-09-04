import { hasPaidAccess } from '../constants/plans.js';
import {
  evaluateProjectContextFreshness,
  isWithinLoginEvalInterval,
} from './projectMemoryLoginEval.js';

/**
 * À chaque login strict : évalue le contexte mémoire du projet courant
 * et lance un scan IA silencieux si stale.
 */
export function createProjectMemoryLoginEvalService({
  projectRepository,
  projectMemorySnapshotRepository,
  projectMemoryNodeRepository,
  projectMemoryScanService,
  settingsService = null,
}) {
  /** @type {Set<number>} */
  const running = new Set();

  async function memoryLoginConfig() {
    if (settingsService?.getMemoryConfig) {
      const memory = await settingsService.getMemoryConfig();
      return {
        enabled: memory.loginEvalEnabled !== false,
        minIntervalHours: Number(memory.loginEvalMinIntervalHours) || 12,
        eventThreshold: Number(memory.snapshotEventThreshold) || 8,
        maxAgeHours: Number(memory.snapshotMaxAgeHours) || 24,
      };
    }
    return {
      enabled: true,
      minIntervalHours: 12,
      eventThreshold: 8,
      maxAgeHours: 24,
    };
  }

  async function countActiveNodes(projectId) {
    if (projectMemoryNodeRepository.countActiveByProjectId) {
      return projectMemoryNodeRepository.countActiveByProjectId(projectId);
    }
    const nodes = await projectMemoryNodeRepository.listActiveByImportance(projectId, {
      limit: 1,
    });
    return nodes.length > 0 ? 1 : 0;
  }

  async function markEval(projectId) {
    if (projectRepository.touchMemoryLoginEvalAt) {
      await projectRepository.touchMemoryLoginEvalAt(projectId);
    }
  }

  return {
    /**
     * Fire-and-forget depuis le login. Ne doit jamais faire échouer l'auth.
     * @param {{ id: number, plan?: string, role?: string }} user
     */
    scheduleAfterLogin(user) {
      if (!user?.id) return;
      setImmediate(() => {
        this.evaluateAfterLogin(user).catch((err) => {
          console.warn('[memory] login eval:', err.message);
        });
      });
    },

    async evaluateAfterLogin(user) {
      const cfg = await memoryLoginConfig();
      if (!cfg.enabled) {
        return { decision: 'skip', reason: 'disabled' };
      }
      if (!hasPaidAccess(user)) {
        return { decision: 'skip', reason: 'not_paid' };
      }
      if (!projectMemoryScanService?.scanAndRebuild) {
        return { decision: 'skip', reason: 'scan_unavailable' };
      }

      const projects = await projectRepository.findByUserId(user.id);
      const project = projects[0] || null;
      if (!project) {
        return { decision: 'skip', reason: 'no_project' };
      }

      const projectId = Number(project.id);
      if (running.has(projectId)) {
        return { decision: 'skip', reason: 'already_running', projectId };
      }

      if (isWithinLoginEvalInterval(project.memoryLoginEvalAt, cfg.minIntervalHours)) {
        return {
          decision: 'skip',
          reason: 'min_interval',
          projectId,
        };
      }

      const [snapshot, activeNodeCount] = await Promise.all([
        projectMemorySnapshotRepository.findByProjectId(projectId),
        countActiveNodes(projectId),
      ]);

      const verdict = evaluateProjectContextFreshness({
        snapshot,
        activeNodeCount,
        projectUpdatedAt: project.updatedAt,
        eventThreshold: cfg.eventThreshold,
        maxAgeHours: cfg.maxAgeHours,
      });

      await markEval(projectId);

      if (verdict.decision !== 'full') {
        return {
          decision: 'fresh',
          projectId,
          reasons: verdict.reasons,
          score: verdict.score,
        };
      }

      running.add(projectId);
      try {
        console.info(
          `[memory] login scan project=${projectId} reasons=${verdict.reasons.join(',')}`
        );
        await projectMemoryScanService.scanAndRebuild(projectId);
        return {
          decision: 'full',
          projectId,
          reasons: verdict.reasons,
          score: verdict.score,
          scanned: true,
        };
      } finally {
        running.delete(projectId);
      }
    },
  };
}

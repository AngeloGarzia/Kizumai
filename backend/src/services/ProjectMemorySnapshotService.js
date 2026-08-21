import { config } from '../config/index.js';

/**
 * Régénération du snapshot consolidé via l'IA.
 */
export function createProjectMemorySnapshotService({
  projectMemoryNodeRepository,
  projectMemorySnapshotRepository,
  aiService,
  settingsService = null,
}) {
  async function memoryConfig() {
    if (settingsService) return settingsService.getMemoryConfig();
    return {
      snapshotTopNodes: Number(config.memory?.snapshotTopNodes) || 40,
      snapshotEventThreshold: Number(config.memory?.snapshotEventThreshold) || 8,
      snapshotMaxAgeHours: Number(config.memory?.snapshotMaxAgeHours) || 24,
    };
  }

  return {
    async regenerate(projectId) {
      const memory = await memoryConfig();
      const topN = Number(memory.snapshotTopNodes) || 40;
      const nodes = await projectMemoryNodeRepository.listActiveByImportance(projectId, {
        limit: topN,
      });
      if (!nodes.length) {
        return projectMemorySnapshotRepository.upsertForProject({
          projectId,
          summary: 'Aucune mémoire active pour ce projet.',
          keyFacts: [],
          activeBlockers: [],
          nextActions: [],
          modelUsed: 'none',
          tokenCount: 0,
        });
      }

      const prior = await projectMemorySnapshotRepository.findByProjectId(projectId);
      const memoriesText = nodes
        .map((n) => `- [${n.nodeType}|${Number(n.importance).toFixed(2)}] ${n.content}`)
        .join('\n');

      let result;
      try {
        result = await aiService.generateMemorySnapshot({
          memoriesText,
          priorSummary: prior?.summary || '',
        });
      } catch (err) {
        console.warn('[memory] snapshot IA échoué, fallback heuristique:', err.message);
        result = {
          summary: nodes
            .slice(0, 8)
            .map((n) => n.content)
            .join(' '),
          keyFacts: nodes.slice(0, 5).map((n) => n.content.slice(0, 120)),
          activeBlockers: nodes
            .filter((n) => n.nodeType === 'risk' || n.nodeType === 'insight')
            .slice(0, 3)
            .map((n) => n.content.slice(0, 120)),
          nextActions: nodes
            .filter((n) => n.nodeType === 'task_state' || n.nodeType === 'milestone')
            .slice(0, 3)
            .map((n) => n.content.slice(0, 120)),
          provider: 'heuristic',
          model: 'heuristic',
        };
      }

      const summary = result.summary || memoriesText.slice(0, 1500);
      return projectMemorySnapshotRepository.upsertForProject({
        projectId,
        summary,
        keyFacts: result.keyFacts || [],
        activeBlockers: result.activeBlockers || [],
        nextActions: result.nextActions || [],
        modelUsed: result.model || result.provider || null,
        tokenCount: Math.ceil(summary.length / 4),
      });
    },

    async regenerateDue() {
      const memory = await memoryConfig();
      const due = await projectMemorySnapshotRepository.listProjectsNeedingSnapshot({
        eventThreshold: Number(memory.snapshotEventThreshold) || 8,
        maxAgeHours: Number(memory.snapshotMaxAgeHours) || 24,
      });
      const results = [];
      for (const snap of due) {
        try {
          results.push(await this.regenerate(snap.projectId));
        } catch (err) {
          console.warn(`[memory] snapshot projet #${snap.projectId}:`, err.message);
        }
      }

      // Projets avec nœuds mais jamais de snapshot
      const ids = await projectMemorySnapshotRepository.listProjectIdsWithActiveNodes();
      const existing = new Set(due.map((d) => d.projectId));
      for (const projectId of ids) {
        if (existing.has(projectId)) continue;
        const snap = await projectMemorySnapshotRepository.findByProjectId(projectId);
        if (!snap || !snap.summary) {
          try {
            results.push(await this.regenerate(projectId));
          } catch (err) {
            console.warn(`[memory] snapshot initial #${projectId}:`, err.message);
          }
        }
      }

      return results;
    },
  };
}

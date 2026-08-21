import { config } from '../config/index.js';

const KEY_CONTACT_CATEGORIES = new Set([
  'expert_comptable',
  'notaire',
  'avocat',
  'banquier',
  'assureur',
  'conseil',
]);

const STRUCTURAL_SOURCES = new Set([
  'project',
  'company',
  'accounting_profile',
  'company_officer',
]);

/**
 * Création / renforcement de nœuds et arêtes suite aux événements métier.
 */
export function createProjectMemoryUpdateService({
  projectMemoryNodeRepository,
  projectMemoryEdgeRepository,
  projectMemorySnapshotRepository,
  aiService,
  projectMemorySnapshotService = null,
  settingsService = null,
}) {
  async function eventThreshold() {
    if (settingsService) {
      const memory = await settingsService.getMemoryConfig();
      return Number(memory.snapshotEventThreshold) || 8;
    }
    return Number(config.memory?.snapshotEventThreshold) || 8;
  }

  async function maybeEmbed(content) {
    if (!aiService?.embedText) return null;
    try {
      return await aiService.embedText(content);
    } catch {
      return null;
    }
  }

  function scheduleSnapshotIfNeeded(projectId, needsSnapshot) {
    if (!needsSnapshot || !projectMemorySnapshotService?.regenerate) return;
    setImmediate(() => {
      projectMemorySnapshotService.regenerate(projectId).catch((err) => {
        console.warn('[memory] snapshot auto:', err.message);
      });
    });
  }

  return {
    isKeyContactCategory(category) {
      return KEY_CONTACT_CATEGORIES.has(String(category || '').toLowerCase());
    },

    /**
     * Enregistre un souvenir (idempotent si source polymorphe fournie).
     */
    async recordEvent({
      projectId,
      nodeType = 'event',
      content,
      sourceEntityType = null,
      sourceEntityId = null,
      importance = 0.5,
      confidence = 1,
      decayRate = null,
      relatedNodeIds = [],
      relationType = 'relates_to',
      triggerSnapshot = true,
    }) {
      if (!projectId || !content?.trim()) return null;

      const text = String(content).trim().slice(0, 6000);
      const resolvedDecay =
        decayRate != null
          ? decayRate
          : STRUCTURAL_SOURCES.has(sourceEntityType)
            ? 0.002
            : 0.01;

      const embedding = await maybeEmbed(text);
      const node = await projectMemoryNodeRepository.upsertFromSource({
        projectId,
        nodeType,
        content: text,
        sourceEntityType,
        sourceEntityId,
        importance,
        confidence,
        decayRate: resolvedDecay,
        embedding,
      });

      if (relatedNodeIds?.length && node?.id) {
        for (const otherId of relatedNodeIds) {
          if (!otherId || otherId === node.id) continue;
          await projectMemoryEdgeRepository.upsertEdge({
            projectId,
            sourceNodeId: node.id,
            targetNodeId: otherId,
            relationType,
          });
          await projectMemoryNodeRepository.reinforce(otherId, {
            importanceBoost: 0.02,
          });
        }
      }

      const snap = await projectMemorySnapshotRepository.incrementEvents(projectId, 1);
      const needsSnapshot = Boolean(
        snap?.eventsSinceSnapshot >= (await eventThreshold())
      );
      if (triggerSnapshot) {
        scheduleSnapshotIfNeeded(projectId, needsSnapshot);
      }

      return { node, needsSnapshot };
    },

    /** Fire-and-forget safe wrapper. */
    recordEventSafe(payload) {
      this.recordEvent(payload).catch((err) => {
        console.warn('[memory] recordEvent:', err.message);
      });
    },
  };
}

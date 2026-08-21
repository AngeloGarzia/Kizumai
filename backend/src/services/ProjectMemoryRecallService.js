import { config } from '../config/index.js';
import { assembleRecallContext } from './projectMemoryMath.js';
import { AppError } from '../utils/AppError.js';

const DEFAULT_SITUATION_INTENT =
  'Résumé de situation pour le porteur : où en est le projet, faits importants, blocages, prochaines actions.';

/**
 * Assemblage du contexte de rappel pour l'IA API.
 */
export function createProjectMemoryRecallService({
  projectMemoryNodeRepository,
  projectMemoryEdgeRepository,
  projectMemorySnapshotRepository,
  aiService,
  settingsService = null,
}) {
  return {
    async buildRecallContext(projectId, intent = '', options = {}) {
      const memory = settingsService
        ? await settingsService.getMemoryConfig()
        : {
            recallMaxChars: Number(config.memory?.recallMaxChars) || 4000,
            graphDepth: Number(config.memory?.graphDepth) || 2,
            recallNodeLimit: Number(config.memory?.recallNodeLimit) || 12,
          };
      const maxChars = Number(options.maxChars) || Number(memory.recallMaxChars) || 4000;
      const depth = Number(options.depth) || Number(memory.graphDepth) || 2;
      const limit = Number(options.limit) || Number(memory.recallNodeLimit) || 12;

      const snapshot = await projectMemorySnapshotRepository.findByProjectId(projectId);

      let seedNodes = [];
      const embedding = intent && aiService?.embedText
        ? await aiService.embedText(intent).catch(() => null)
        : null;

      if (embedding) {
        seedNodes = await projectMemoryNodeRepository.similaritySearch(projectId, embedding, {
          limit,
        });
      }
      if (!seedNodes.length && intent) {
        seedNodes = await projectMemoryNodeRepository.searchByText(projectId, intent, { limit });
      }
      if (!seedNodes.length) {
        seedNodes = await projectMemoryNodeRepository.listActiveByImportance(projectId, {
          limit,
        });
      }

      for (const n of seedNodes.slice(0, 8)) {
        await projectMemoryNodeRepository.reinforce(n.id, { importanceBoost: 0.01 }).catch(() => {});
      }

      const graph = await projectMemoryEdgeRepository.neighbors(
        seedNodes.map((n) => n.id),
        { depth, projectId }
      );

      const nodeMap = new Map();
      for (const n of [...seedNodes, ...(graph.nodes || [])]) {
        nodeMap.set(n.id, n);
      }
      const nodes = [...nodeMap.values()].sort(
        (a, b) => (b.importance || 0) - (a.importance || 0)
      );

      return assembleRecallContext({
        snapshot,
        nodes,
        edges: graph.edges || [],
        intent,
        maxChars,
      });
    },

    /**
     * Recall + synthèse IA pour un résumé de situation (accueil).
     */
    async summarizeSituation(projectId, options = {}) {
      const intent = String(options.intent || DEFAULT_SITUATION_INTENT).trim();
      const context = await this.buildRecallContext(projectId, intent, options);

      if (!context.hasSnapshot && !context.nodeCount) {
        return {
          summary:
            'Aucune mémoire projet pour l’instant. Avance dans ton parcours (étapes, documents, contacts) pour que Kizumai construise ce résumé.',
          keyFacts: [],
          nextActions: [],
          empty: true,
          context: {
            nodeCount: 0,
            edgeCount: 0,
            hasSnapshot: false,
            truncated: false,
          },
          source: 'empty',
        };
      }

      const snapshotText = context.hasSnapshot
        ? [
            context.snapshot?.summary || '',
            context.snapshot?.keyFacts?.length
              ? `Faits: ${context.snapshot.keyFacts.join(' · ')}`
              : '',
            context.snapshot?.activeBlockers?.length
              ? `Blocages: ${context.snapshot.activeBlockers.join(' · ')}`
              : '',
            context.snapshot?.nextActions?.length
              ? `Actions: ${context.snapshot.nextActions.join(' · ')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';

      const nodesText = (context.nodes || [])
        .slice(0, 16)
        .map((n) => `- [${n.nodeType}] ${n.content}`)
        .join('\n');

      try {
        const ai = await aiService.generateMemoryRecallSummary({
          intent,
          snapshotText,
          nodesText,
        });
        if (!ai.summary) {
          throw new AppError('Résumé IA vide', 502);
        }
        return {
          summary: ai.summary,
          keyFacts: ai.keyFacts || [],
          nextActions: ai.nextActions || [],
          empty: false,
          context: {
            nodeCount: context.nodeCount,
            edgeCount: context.edgeCount,
            hasSnapshot: context.hasSnapshot,
            truncated: context.truncated,
          },
          source: 'ai',
          provider: ai.provider,
          model: ai.model,
        };
      } catch (err) {
        console.warn('[memory] recall synthèse IA:', err.message);
        // Repli : contexte assemblé brut (sans inventer)
        return {
          summary: context.text.slice(0, 1500),
          keyFacts: context.snapshot?.keyFacts || [],
          nextActions: context.snapshot?.nextActions || [],
          empty: false,
          context: {
            nodeCount: context.nodeCount,
            edgeCount: context.edgeCount,
            hasSnapshot: context.hasSnapshot,
            truncated: context.truncated,
          },
          source: 'fallback',
        };
      }
    },
  };
}

import { config } from '../config/index.js';
import { getProviderById, resolveModel } from '../config/aiProviders.js';

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

export function createSettingsService({ settingsRepository, aiPromptRepository }) {
  async function settingsObject() {
    return settingsRepository.getAsObject();
  }

  return {
    async getAiConfig() {
      const settings = await settingsObject();
      const ideeSystemPrompt = await aiPromptRepository.findByKey('idee_system');
      const userPrompt = await aiPromptRepository.findByKey('project_user');
      const lieuxPrompt = await aiPromptRepository.findByKey('lieux');
      const budgetPrompt = await aiPromptRepository.findByKey('budget');
      const formationPrompt = await aiPromptRepository.findByKey('formation');
      const documentScanPrompt = await aiPromptRepository.findByKey('document_scan');
      const memorySnapshotPrompt = await aiPromptRepository.findByKey('memory_snapshot');
      const memoryRecallPrompt = await aiPromptRepository.findByKey('memory_recall');

      const provider = settings.ai_provider || config.ai.defaultProvider;
      const providerDef = getProviderById(provider);
      const model = resolveModel(provider, settings.ai_model)
        || providerDef?.defaultModel
        || config.ai.defaultModel;

      return {
        provider,
        model,
        temperature: num(settings.ai_temperature, 0.7),
        ideeSystemPrompt: ideeSystemPrompt?.content || null,
        userPromptTemplate: userPrompt?.content || null,
        lieuxPrompt: lieuxPrompt?.content || null,
        budgetPrompt: budgetPrompt?.content || null,
        formationPrompt: formationPrompt?.content || null,
        documentScanPrompt: documentScanPrompt?.content || null,
        memorySnapshotPrompt: memorySnapshotPrompt?.content || null,
        memoryRecallPrompt: memoryRecallPrompt?.content || null,
      };
    },

    /** Mémoire projet — DB prioritaire, env en repli. */
    async getMemoryConfig() {
      const s = await settingsObject();
      const env = config.memory || {};
      return {
        archiveThreshold: num(s.memory_archive_threshold, env.archiveThreshold ?? 0.05),
        snapshotEventThreshold: num(
          s.memory_snapshot_event_threshold,
          env.snapshotEventThreshold ?? 8
        ),
        snapshotMaxAgeHours: num(
          s.memory_snapshot_max_age_hours,
          env.snapshotMaxAgeHours ?? 24
        ),
        snapshotTopNodes: num(s.memory_snapshot_top_nodes, env.snapshotTopNodes ?? 40),
        recallMaxChars: num(s.memory_recall_max_chars, env.recallMaxChars ?? 4000),
        graphDepth: num(s.memory_graph_depth, env.graphDepth ?? 2),
        recallNodeLimit: num(s.memory_recall_node_limit, env.recallNodeLimit ?? 12),
        decayCron: String(s.memory_decay_cron || env.decayCron || '0 */6 * * *'),
        snapshotCron: String(s.memory_snapshot_cron || env.snapshotCron || '15 */6 * * *'),
        defaultDecayRate: num(s.memory_default_decay_rate, 0.01),
      };
    },

    /** Règles métier partagées. */
    async getBusinessConfig() {
      const s = await settingsObject();
      const min = Math.max(1, num(s.budget_eur_min, 500));
      const max = Math.max(min, num(s.budget_eur_max, 1_000_000));
      return {
        budgetEurMin: min,
        budgetEurMax: max,
      };
    },

    /**
     * Flags non secrets.
     * Env ALLOW_SELF_SERVE_PAID a priorité si défini explicitement.
     */
    async getFeatureFlags() {
      const s = await settingsObject();
      const envOverride = process.env.ALLOW_SELF_SERVE_PAID;
      let selfServePaidEnabled;
      if (envOverride != null) {
        selfServePaidEnabled = envOverride === 'true';
      } else if (s.self_serve_paid_enabled != null && String(s.self_serve_paid_enabled).trim() !== '') {
        selfServePaidEnabled = bool(s.self_serve_paid_enabled, false);
      } else {
        selfServePaidEnabled = Boolean(config.billing.selfServePaidEnabled);
      }

      return { selfServePaidEnabled };
    },
  };
}

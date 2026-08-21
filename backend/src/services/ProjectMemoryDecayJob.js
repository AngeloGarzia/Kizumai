import { config } from '../config/index.js';

/**
 * Job de décroissance / archivage des nœuds de mémoire.
 */
export function createProjectMemoryDecayJob({
  projectMemoryNodeRepository,
  settingsService = null,
}) {
  return {
    async runOnce() {
      const memory = settingsService
        ? await settingsService.getMemoryConfig()
        : { archiveThreshold: Number(config.memory?.archiveThreshold) || 0.05 };
      const threshold = Number(memory.archiveThreshold) || 0.05;
      const decayed = await projectMemoryNodeRepository.applyDecayBatch();
      const archived = await projectMemoryNodeRepository.archiveBelowThreshold(threshold);
      return { decayed, archived };
    },
  };
}

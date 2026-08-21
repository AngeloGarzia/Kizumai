import cron from 'node-cron';
import { config } from '../config/index.js';

/**
 * Démarre les jobs cron mémoire (decay + snapshots).
 * Les expressions cron sont lues une fois au démarrage (Setup → redémarrage pour appliquer).
 * Les seuils (archivage, âge snapshot, etc.) sont relus à chaque exécution via settingsService.
 */
export function startProjectMemoryJobs({
  projectMemoryDecayJob,
  projectMemorySnapshotService,
  settingsService = null,
}) {
  const tasks = [];

  async function resolveCrons() {
    if (settingsService) {
      try {
        const memory = await settingsService.getMemoryConfig();
        return {
          decayExpr: memory.decayCron || '0 */6 * * *',
          snapshotExpr: memory.snapshotCron || '15 */6 * * *',
        };
      } catch (err) {
        console.warn('[memory] lecture cron Setup impossible:', err.message);
      }
    }
    return {
      decayExpr: config.memory?.decayCron || '0 */6 * * *',
      snapshotExpr: config.memory?.snapshotCron || '15 */6 * * *',
    };
  }

  return resolveCrons().then(({ decayExpr, snapshotExpr }) => {
    if (cron.validate(decayExpr)) {
      const t = cron.schedule(decayExpr, async () => {
        try {
          const result = await projectMemoryDecayJob.runOnce();
          console.log(
            `[memory] decay: ${result.decayed} mis à jour, ${result.archived} archivés`
          );
        } catch (err) {
          console.warn('[memory] decay job:', err.message);
        }
      });
      tasks.push(t);
    }

    if (cron.validate(snapshotExpr)) {
      const t = cron.schedule(snapshotExpr, async () => {
        try {
          const results = await projectMemorySnapshotService.regenerateDue();
          if (results.length) {
            console.log(`[memory] snapshots régénérés: ${results.length}`);
          }
        } catch (err) {
          console.warn('[memory] snapshot job:', err.message);
        }
      });
      tasks.push(t);
    }

    console.log(`[memory] jobs cron démarrés (decay=${decayExpr}, snapshot=${snapshotExpr})`);

    return {
      stop() {
        for (const t of tasks) t.stop();
      },
    };
  });
}

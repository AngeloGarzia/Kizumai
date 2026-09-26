import cron from 'node-cron';
import { enqueueAssistantCheckup } from '../queue/assistantQueue.js';

/**
 * Cron : enqueue un checkup assistant par projet éligible.
 */
export function startProjectAssistantJobs({
  projectAssistantService,
  settingsService = null,
}) {
  const tasks = [];

  async function resolveCron() {
    if (settingsService?.getAssistantConfig) {
      try {
        const cfg = await settingsService.getAssistantConfig();
        if (!cfg.enabled) return null;
        return cfg.checkupCron || '0 */2 * * *';
      } catch (err) {
        console.warn('[assistant] lecture cron Setup:', err.message);
      }
    }
    return '0 */2 * * *';
  }

  return resolveCron().then((expr) => {
    if (!expr) {
      console.log('[assistant] jobs désactivés');
      return { stop() {} };
    }
    if (!cron.validate(expr)) {
      console.warn(`[assistant] cron invalide: ${expr}`);
      return { stop() {} };
    }

    const t = cron.schedule(expr, async () => {
      try {
        const { projects } = await projectAssistantService.enqueueEligibleCheckups();
        let n = 0;
        for (const projectId of projects || []) {
          await enqueueAssistantCheckup({ projectId });
          n += 1;
        }
        if (n) console.log(`[assistant] checkups enfilés: ${n}`);
      } catch (err) {
        console.warn('[assistant] cron:', err.message);
      }
    });
    tasks.push(t);
    console.log(`[assistant] jobs cron démarrés (${expr})`);

    return {
      stop() {
        for (const task of tasks) task.stop();
      },
    };
  });
}

import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getRedisConnection } from './connection.js';
import { QUEUE_NAMES, JOB_TYPES } from './queues.js';
import {
  initAssistantJobProcessor,
  releaseAssistantProject,
} from './assistantQueue.js';

let assistantWorker = null;

export function startAssistantProcessing(container) {
  const projectAssistantService = container.services.projectAssistantService;
  if (!projectAssistantService) return;

  const processor = async (job) => {
    const projectId = Number(job.data?.projectId);
    try {
      return await projectAssistantService.runCheckup(projectId);
    } finally {
      releaseAssistantProject(projectId);
    }
  };

  initAssistantJobProcessor(async (job) => {
    await processor(job);
  });

  if (!config.queue.enabled) {
    console.log('[assistant] File locale (Redis off)');
    return;
  }

  const connection = getRedisConnection();
  if (!connection) return;

  if (assistantWorker) return assistantWorker;

  assistantWorker = new Worker(
    QUEUE_NAMES.ASSISTANT,
    async (job) => {
      if (job.name === JOB_TYPES.ASSISTANT_CHECKUP) {
        return processor(job);
      }
      return { skipped: 'unknown-job' };
    },
    {
      connection,
      prefix: config.queue.prefix,
      concurrency: 2,
    }
  );

  assistantWorker.on('failed', (job, err) => {
    releaseAssistantProject(job?.data?.projectId);
    console.warn(`[assistant] Job ${job?.id} échoué : ${err.message}`);
  });
  assistantWorker.on('completed', (job) => {
    releaseAssistantProject(job?.data?.projectId);
  });
  assistantWorker.on('ready', () => {
    console.log('[queue] Worker « assistant » prêt');
  });

  return assistantWorker;
}

export async function stopAssistantProcessing() {
  if (assistantWorker) {
    await assistantWorker.close().catch(() => {});
    assistantWorker = null;
  }
}

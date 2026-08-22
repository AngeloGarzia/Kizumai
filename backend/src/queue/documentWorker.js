import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getRedisConnection } from './connection.js';
import { QUEUE_NAMES } from './queues.js';
import { DOCUMENT_LIMITS } from '../services/documentProcessingLimits.js';

let documentWorker = null;

/**
 * Worker BullMQ dédié aux extractions / scans (concurrence limitée).
 */
export function startDocumentWorker(processor) {
  if (!config.queue.enabled) {
    console.log('[queue] File documents désactivée — traitement local');
    return null;
  }
  if (documentWorker) return documentWorker;

  const connection = getRedisConnection();
  if (!connection) return null;

  documentWorker = new Worker(
    QUEUE_NAMES.DOCUMENTS,
    async (job) => {
      await processor({ kind: job.name, data: job.data, name: job.name });
      return { ok: true };
    },
    {
      connection,
      prefix: config.queue.prefix,
      concurrency: DOCUMENT_LIMITS.workerConcurrency,
      lockDuration: DOCUMENT_LIMITS.jobTimeoutMs + 30_000,
      maxStalledCount: 1,
    }
  );

  documentWorker.on('failed', (job, err) => {
    console.warn(`[queue:documents] Job ${job?.id} (${job?.name}) échoué : ${err.message}`);
  });
  documentWorker.on('ready', () => {
    console.log(
      `[queue] Worker « documents » prêt (concurrence ${DOCUMENT_LIMITS.workerConcurrency})`
    );
  });

  return documentWorker;
}

export async function stopDocumentWorker() {
  if (documentWorker) {
    await documentWorker.close().catch(() => {});
    documentWorker = null;
  }
}

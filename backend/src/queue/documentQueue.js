import { getQueue, QUEUE_NAMES, JOB_TYPES } from './queues.js';
import { config } from '../config/index.js';
import { DOCUMENT_LIMITS } from '../services/documentProcessingLimits.js';

/** @typedef {'extract'|'scan'} DocumentJobKind */

let localQueue = null;
let processorFn = null;
let localRunning = 0;
const pendingExtractIds = new Set();

function releaseExtractId(documentId) {
  if (documentId != null) pendingExtractIds.delete(Number(documentId));
}

function getLocalQueue() {
  if (!localQueue) {
    localQueue = [];
  }
  return localQueue;
}

async function pumpLocalQueue() {
  if (!processorFn) return;
  while (localRunning < DOCUMENT_LIMITS.workerConcurrency && getLocalQueue().length > 0) {
    localRunning += 1;
    const job = getLocalQueue().shift();
    processorFn(job)
      .catch((err) => {
        console.warn(`[doc-queue:local] Job ${job.kind} échoué : ${err.message}`);
      })
      .finally(() => {
        if (job.kind === 'extract' && job.data?.documentId != null) {
          releaseExtractId(job.data.documentId);
        }
        localRunning -= 1;
        pumpLocalQueue();
      });
  }
}

/**
 * Enregistre le processeur (extract + scan) — appelé au démarrage serveur.
 * @param {(job: { kind: DocumentJobKind, data: object }) => Promise<void>} fn
 */
export function initDocumentJobProcessor(fn) {
  processorFn = fn;
  pumpLocalQueue();
}

async function enqueueLocal(kind, data) {
  getLocalQueue().push({ kind, data });
  pumpLocalQueue();
}

async function enqueueBull(kind, data, jobType) {
  const queue = getQueue(QUEUE_NAMES.DOCUMENTS);
  if (!queue) {
    await enqueueLocal(kind, data);
    return { mode: 'local', kind, data };
  }

  const job = await queue.add(jobType, data, {
    attempts: DOCUMENT_LIMITS.jobAttempts,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 3600, count: 2000 },
    removeOnFail: { age: 24 * 3600, count: 5000 },
  });
  return { mode: 'bullmq', id: job.id, kind };
}

export async function enqueueDocumentExtract(data) {
  const documentId = Number(data?.documentId);
  if (documentId && pendingExtractIds.has(documentId)) {
    return { mode: 'deduped', documentId };
  }
  if (documentId) pendingExtractIds.add(documentId);
  try {
    return await enqueueBull('extract', data, JOB_TYPES.DOCUMENT_EXTRACT);
  } catch (err) {
    releaseExtractId(documentId);
    throw err;
  }
}

export async function enqueueDocumentScan(data) {
  return enqueueBull('scan', data, JOB_TYPES.DOCUMENT_SCAN);
}

export function isDocumentQueueEnabled() {
  return config.queue.enabled && Boolean(getQueue(QUEUE_NAMES.DOCUMENTS));
}

import { getQueue, QUEUE_NAMES, JOB_TYPES } from './queues.js';

let localQueue = null;
let processorFn = null;
let localRunning = 0;
const pendingProjects = new Set();

function getLocalQueue() {
  if (!localQueue) localQueue = [];
  return localQueue;
}

async function pumpLocalQueue() {
  if (!processorFn) return;
  while (localRunning < 2 && getLocalQueue().length > 0) {
    localRunning += 1;
    const job = getLocalQueue().shift();
    processorFn(job)
      .catch((err) => {
        console.warn(`[assistant-queue:local] échec : ${err.message}`);
      })
      .finally(() => {
        if (job?.data?.projectId != null) {
          pendingProjects.delete(Number(job.data.projectId));
        }
        localRunning -= 1;
        pumpLocalQueue();
      });
  }
}

export function initAssistantJobProcessor(fn) {
  processorFn = fn;
  pumpLocalQueue();
}

async function enqueueLocal(data) {
  getLocalQueue().push({ kind: 'checkup', data });
  pumpLocalQueue();
  return { mode: 'local', data };
}

export async function enqueueAssistantCheckup(data) {
  const projectId = Number(data?.projectId);
  if (!projectId) return { mode: 'skipped' };
  if (pendingProjects.has(projectId)) {
    return { mode: 'deduped', projectId };
  }
  pendingProjects.add(projectId);

  const queue = getQueue(QUEUE_NAMES.ASSISTANT);
  if (!queue) {
    try {
      return await enqueueLocal(data);
    } catch (err) {
      pendingProjects.delete(projectId);
      throw err;
    }
  }

  try {
    const job = await queue.add(
      JOB_TYPES.ASSISTANT_CHECKUP,
      data,
      {
        jobId: `assistant-checkup-${projectId}`,
        attempts: 2,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 24 * 3600, count: 1000 },
      }
    );
    return { mode: 'bullmq', id: job.id };
  } catch (err) {
    // jobId conflict = déjà en file
    if (String(err.message || '').includes('Job') || err.name === 'JobAlreadyExistsError') {
      pendingProjects.delete(projectId);
      return { mode: 'deduped', projectId };
    }
    pendingProjects.delete(projectId);
    try {
      return await enqueueLocal(data);
    } catch {
      throw err;
    }
  }
}

export function releaseAssistantProject(projectId) {
  if (projectId != null) pendingProjects.delete(Number(projectId));
}

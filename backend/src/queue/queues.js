import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import { getRedisConnection } from './connection.js';

// Noms logiques des files et des types de jobs.
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
};

export const JOB_TYPES = {
  PLANNER_REMINDER: 'planner-reminder',
};

const queues = new Map();

/**
 * Renvoie (en la créant à la demande) la file BullMQ demandée.
 * Renvoie `null` si la file d'attente est désactivée : les appelants doivent
 * gérer ce cas (dégradation silencieuse, l'app fonctionne sans Redis).
 */
export function getQueue(name = QUEUE_NAMES.NOTIFICATIONS) {
  if (!config.queue.enabled) return null;

  if (queues.has(name)) return queues.get(name);

  const connection = getRedisConnection();
  if (!connection) return null;

  const queue = new Queue(name, {
    connection,
    prefix: config.queue.prefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });

  queue.on('error', (err) => {
    console.warn(`[queue:${name}] ${err.message}`);
  });

  queues.set(name, queue);
  return queue;
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
}

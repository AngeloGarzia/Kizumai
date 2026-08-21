import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getRedisConnection } from './connection.js';
import { QUEUE_NAMES, JOB_TYPES } from './queues.js';
import { PlannerEventRepository } from '../repositories/PlannerEventRepository.js';
import { container } from '../container/index.js';

const { notificationService } = container.services;

let worker = null;

const KIND_PREFIX = {
  task: 'Tâche',
  deadline: 'Échéance',
  appointment: 'Rendez-vous',
  reminder: 'Rappel',
};

function buildReminderPayload(event) {
  const prefix = KIND_PREFIX[event.kind] || 'Rappel';
  const when = new Date(event.startAt).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: event.allDay ? undefined : 'short',
  });

  const parts = [when];
  if (event.location) parts.push(`📍 ${event.location}`);
  if (event.description) parts.push(event.description);

  return {
    title: `${prefix} : ${event.title}`,
    body: parts.join(' — '),
    url: `${config.appUrl}/planner`,
  };
}

async function processReminder(job) {
  const { eventId } = job.data;
  const event = await PlannerEventRepository.findById(eventId);

  // L'événement a pu être supprimé, terminé ou annulé entre-temps.
  if (!event) return { skipped: 'deleted' };
  if (!['todo', 'in_progress'].includes(event.status)) return { skipped: event.status };

  const result = await notificationService.notifyUser(event.userId, buildReminderPayload(event));
  return { channel: result.channel };
}

/**
 * Démarre le worker BullMQ. No-op si la file est désactivée.
 */
export function startWorker() {
  if (!config.queue.enabled) {
    console.log('[queue] File désactivée (aucune URL Redis) — worker non démarré');
    return null;
  }
  if (worker) return worker;

  const connection = getRedisConnection();
  if (!connection) return null;

  worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      if (job.name === JOB_TYPES.PLANNER_REMINDER) {
        return processReminder(job);
      }
      return { skipped: 'unknown-job' };
    },
    {
      connection,
      prefix: config.queue.prefix,
      concurrency: config.queue.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    console.warn(`[queue] Job ${job?.id} échoué : ${err.message}`);
  });
  worker.on('ready', () => {
    console.log('[queue] Worker « notifications » prêt');
  });

  return worker;
}

export async function stopWorker() {
  if (worker) {
    await worker.close().catch(() => {});
    worker = null;
  }
}



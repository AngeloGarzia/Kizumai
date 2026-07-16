import { getQueue, QUEUE_NAMES, JOB_TYPES } from './queues.js';

const reminderJobId = (eventId) => `planner-reminder:${eventId}`;

// Instant du rappel = début - (remindBeforeMinutes). Par défaut : au début.
function reminderTime(event) {
  const start = new Date(event.startAt).getTime();
  const before = Number(event.metadata?.remindBeforeMinutes) || 0;
  return start - before * 60_000;
}

const ACTIVE_STATUSES = new Set(['todo', 'in_progress']);

/**
 * (Re)planifie le rappel d'un événement. Idempotent : on retire l'éventuel job
 * existant avant d'en (re)créer un. Aucun job n'est créé si le rappel est déjà
 * passé, si l'événement est terminé/annulé, ou si la file est désactivée.
 */
export async function schedulePlannerReminder(event) {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
  if (!queue || !event) return;

  const jobId = reminderJobId(event.id);

  try {
    // Retire l'ancien job (mise à jour de date, changement de statut…).
    const existing = await queue.getJob(jobId);
    if (existing) await existing.remove().catch(() => {});

    if (!ACTIVE_STATUSES.has(event.status)) return;

    const delay = reminderTime(event) - Date.now();
    if (delay <= 0) return; // rappel déjà passé : on ne planifie pas dans le passé

    await queue.add(
      JOB_TYPES.PLANNER_REMINDER,
      { eventId: event.id },
      { jobId, delay }
    );
  } catch (err) {
    console.warn(`[queue] Planification du rappel #${event.id} impossible : ${err.message}`);
  }
}

export async function cancelPlannerReminder(eventId) {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
  if (!queue) return;
  try {
    const job = await queue.getJob(reminderJobId(eventId));
    if (job) await job.remove();
  } catch (err) {
    console.warn(`[queue] Annulation du rappel #${eventId} impossible : ${err.message}`);
  }
}

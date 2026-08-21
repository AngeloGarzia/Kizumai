import { AppError } from '../utils/AppError.js';
import { schedulePlannerReminder, cancelPlannerReminder } from '../queue/scheduler.js';

const KINDS = ['task', 'deadline', 'appointment', 'reminder'];
const STATUSES = ['todo', 'in_progress', 'done', 'cancelled'];

function parseDate(value, field) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Date invalide : ${field}`, 400);
  }
  return date.toISOString();
}

function validateEnums({ kind, status }) {
  if (kind !== undefined && !KINDS.includes(kind)) {
    throw new AppError(`Type d'événement invalide : ${kind}`, 400);
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    throw new AppError(`Statut invalide : ${status}`, 400);
  }
}

export function createPlannerService({
  plannerEventRepository,
  projectRepository = null,
  projectMemoryUpdateService = null,
}) {
  async function assertOwnedProjectId(userId, projectId) {
    if (projectId == null || projectId === '') return null;
    const pid = Number(projectId);
    if (!Number.isInteger(pid) || pid < 1) {
      throw new AppError('projectId invalide', 400);
    }
    if (!projectRepository) {
      throw new AppError('Liaison projet indisponible', 500);
    }
    const project = await projectRepository.findById(pid);
    if (!project || project.userId !== userId) {
      throw new AppError('Projet introuvable', 404);
    }
    return pid;
  }

  return {
    async list(userId, { from, to } = {}) {
      return plannerEventRepository.findByUserInRange(
        userId,
        parseDate(from, 'from'),
        parseDate(to, 'to')
      );
    },

    async getOwned(userId, id) {
      const event = await plannerEventRepository.findById(id);
      if (!event || event.userId !== userId) {
        throw new AppError('Événement introuvable', 404);
      }
      return event;
    },

    async create(userId, payload = {}) {
      const title = (payload.title || '').trim();
      if (!title) throw new AppError('Le titre est requis', 400);

      const startAt = parseDate(payload.startAt, 'startAt');
      if (!startAt) throw new AppError('La date de début est requise', 400);

      const endAt = parseDate(payload.endAt, 'endAt');
      if (endAt && endAt < startAt) {
        throw new AppError('La fin ne peut pas précéder le début', 400);
      }

      validateEnums({ kind: payload.kind, status: payload.status });

      const metadata = {};
      if (payload.remindBeforeMinutes != null) {
        const before = Number(payload.remindBeforeMinutes);
        if (Number.isNaN(before) || before < 0) {
          throw new AppError('remindBeforeMinutes doit être un nombre positif', 400);
        }
        metadata.remindBeforeMinutes = before;
      }

      const projectId = await assertOwnedProjectId(userId, payload.projectId);

      const event = await plannerEventRepository.create({
        userId,
        projectId,
        kind: payload.kind || 'task',
        title,
        description: payload.description ?? null,
        startAt,
        endAt,
        allDay: Boolean(payload.allDay),
        status: payload.status || 'todo',
        location: payload.location ?? null,
        color: payload.color ?? null,
        metadata,
      });

      await schedulePlannerReminder(event);

      if (projectMemoryUpdateService && event.projectId) {
        projectMemoryUpdateService.recordEventSafe({
          projectId: event.projectId,
          nodeType: 'event',
          content: `Événement planifié (${event.kind}) : ${event.title}`,
          sourceEntityType: 'planner_event',
          sourceEntityId: event.id,
          importance: 0.5,
        });
      }

      return event;
    },

    async update(userId, id, payload = {}) {
      const existing = await this.getOwned(userId, id);
      validateEnums({ kind: payload.kind, status: payload.status });

      const fields = {};
      if (payload.title !== undefined) {
        const title = (payload.title || '').trim();
        if (!title) throw new AppError('Le titre est requis', 400);
        fields.title = title;
      }
      if (payload.projectId !== undefined) {
        fields.projectId = await assertOwnedProjectId(userId, payload.projectId);
      }
      if (payload.kind !== undefined) fields.kind = payload.kind;
      if (payload.description !== undefined) fields.description = payload.description;
      if (payload.allDay !== undefined) fields.allDay = Boolean(payload.allDay);
      if (payload.status !== undefined) fields.status = payload.status;
      if (payload.location !== undefined) fields.location = payload.location;
      if (payload.color !== undefined) fields.color = payload.color;
      if (payload.startAt !== undefined) fields.startAt = parseDate(payload.startAt, 'startAt');
      if (payload.endAt !== undefined) fields.endAt = parseDate(payload.endAt, 'endAt');
      if (payload.remindBeforeMinutes !== undefined) {
        const before = Number(payload.remindBeforeMinutes);
        if (Number.isNaN(before) || before < 0) {
          throw new AppError('remindBeforeMinutes doit être un nombre positif', 400);
        }
        fields.metadata = { ...(existing.metadata || {}), remindBeforeMinutes: before };
      }

      const nextStart = fields.startAt ?? existing.startAt;
      const nextEnd = fields.endAt !== undefined ? fields.endAt : existing.endAt;
      if (nextEnd && new Date(nextEnd) < new Date(nextStart)) {
        throw new AppError('La fin ne peut pas précéder le début', 400);
      }

      const event = await plannerEventRepository.update(id, fields);
      await schedulePlannerReminder(event);

      if (
        projectMemoryUpdateService &&
        event.projectId &&
        fields.status === 'done' &&
        existing.status !== 'done'
      ) {
        projectMemoryUpdateService.recordEventSafe({
          projectId: event.projectId,
          nodeType: 'event',
          content: `Événement terminé : ${event.title}`,
          sourceEntityType: 'planner_event',
          sourceEntityId: event.id,
          importance: 0.6,
        });
      }

      return event;
    },

    async remove(userId, id) {
      await this.getOwned(userId, id);
      await plannerEventRepository.delete(id);
      await cancelPlannerReminder(id);
      return true;
    },
  };
}

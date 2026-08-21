import { optionalString, parseId, pick } from './helpers.js';

export const StageParamDto = {
  from(params) {
    return {
      projectId: parseId(params.id, 'projectId'),
      stage: optionalString(params.stage, { max: 30 }) || 'etude_marche',
    };
  },
};

export const StageTaskParamDto = {
  from(params) {
    return {
      ...StageParamDto.from(params),
      taskId: parseId(params.taskId, 'taskId'),
    };
  },
};

export const StageLinkParamDto = {
  from(params) {
    return {
      ...StageParamDto.from(params),
      linkId: parseId(params.linkId, 'linkId'),
    };
  },
};

export const StageMilestoneParamDto = {
  from(params) {
    return {
      ...StageParamDto.from(params),
      milestoneId: parseId(params.milestoneId, 'milestoneId'),
    };
  },
};

export const UpdateStageTaskRequestDto = {
  from(body = {}) {
    return pick(body, ['status', 'notes', 'dueAt']);
  },
};

export const CreateStageLinkRequestDto = {
  from(body = {}) {
    return {
      entityType: optionalString(body.entityType, { max: 30 }),
      entityId: body.entityId != null ? Number(body.entityId) : null,
      role: optionalString(body.role, { max: 80 }),
      note: optionalString(body.note, { max: 2000 }),
    };
  },
};

export const CreateStageContactRequestDto = {
  from(body = {}) {
    return {
      displayName: optionalString(body.displayName || body.name, { max: 200 }),
      firstName: optionalString(body.firstName, { max: 120 }),
      lastName: optionalString(body.lastName, { max: 120 }),
      organization: optionalString(body.organization, { max: 200 }),
      email: optionalString(body.email, { max: 255 }),
      phone: optionalString(body.phone, { max: 40 }),
      notes: optionalString(body.notes, { max: 5000 }),
      role: optionalString(body.role, { max: 80 }),
      category: optionalString(body.category, { max: 40 }),
      contactType: optionalString(body.contactType, { max: 20 }),
    };
  },
};

export const UpdateStageMilestoneRequestDto = {
  from(body = {}) {
    return pick(body, ['title', 'description', 'milestoneAt', 'status', 'taskId']);
  },
};

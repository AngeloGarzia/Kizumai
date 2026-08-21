import { parseId, pick } from './helpers.js';

const CREATE_KEYS = [
  'title',
  'projectId',
  'kind',
  'description',
  'startAt',
  'endAt',
  'allDay',
  'status',
  'location',
  'color',
  'remindBeforeMinutes',
];

const UPDATE_KEYS = [...CREATE_KEYS];

export const ListPlannerEventsQueryDto = {
  from(query = {}) {
    return {
      from: query.from,
      to: query.to,
    };
  },
};

export const PlannerEventIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};

export const CreatePlannerEventRequestDto = {
  from(body = {}) {
    return pick(body, CREATE_KEYS);
  },
};

export const UpdatePlannerEventRequestDto = {
  from(body = {}) {
    return pick(body, UPDATE_KEYS);
  },
};

export const PlannerEventResponseDto = {
  from(event) {
    if (!event) return null;
    return event;
  },
  fromMany(events) {
    return (events || []).map((e) => PlannerEventResponseDto.from(e));
  },
};

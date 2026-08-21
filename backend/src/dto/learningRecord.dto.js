import {
  optionalId,
  optionalString,
  optionalStringArray,
  parseId,
  pick,
  requireString,
} from './helpers.js';
import { AppError } from '../utils/AppError.js';

const RECORD_KEYS = [
  'projectId',
  'documentId',
  'recordType',
  'title',
  'organization',
  'status',
  'level',
  'field',
  'format',
  'startDate',
  'endDate',
  'durationLabel',
  'diplomaObtained',
  'skills',
  'description',
  'notes',
  'source',
];

export const ListLearningRecordsQueryDto = {
  from(query = {}) {
    return {
      projectId:
        query.projectId != null && query.projectId !== ''
          ? parseId(query.projectId, 'projectId')
          : undefined,
      recordType: optionalString(query.recordType, { max: 40 }) || undefined,
    };
  },
};

export const LearningRecordIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};

function mapRecordBody(body = {}) {
  const data = pick(body, RECORD_KEYS);
  const out = {};
  if (data.projectId !== undefined) out.projectId = optionalId(data.projectId, 'projectId');
  if (data.documentId !== undefined) out.documentId = optionalId(data.documentId, 'documentId');
  if (data.recordType !== undefined) {
    out.recordType = requireString(data.recordType, 'recordType', { min: 1, max: 40 });
  }
  if (data.title !== undefined) out.title = requireString(data.title, 'title', { min: 1, max: 300 });
  if (data.organization !== undefined) {
    out.organization = optionalString(data.organization, { max: 200 });
  }
  if (data.status !== undefined) out.status = optionalString(data.status, { max: 40 });
  if (data.level !== undefined) out.level = optionalString(data.level, { max: 80 });
  if (data.field !== undefined) out.field = optionalString(data.field, { max: 120 });
  if (data.format !== undefined) out.format = optionalString(data.format, { max: 80 });
  if (data.startDate !== undefined) out.startDate = optionalString(data.startDate, { max: 40 });
  if (data.endDate !== undefined) out.endDate = optionalString(data.endDate, { max: 40 });
  if (data.durationLabel !== undefined) {
    out.durationLabel = optionalString(data.durationLabel, { max: 80 });
  }
  if (data.diplomaObtained !== undefined) {
    out.diplomaObtained = Boolean(data.diplomaObtained);
  }
  if (data.skills !== undefined) {
    out.skills = Array.isArray(data.skills)
      ? optionalStringArray(data.skills, { maxItems: 40, maxItemLen: 80 })
      : optionalString(data.skills, { max: 1000 });
  }
  if (data.description !== undefined) {
    out.description = optionalString(data.description, { max: 5000 });
  }
  if (data.notes !== undefined) out.notes = optionalString(data.notes, { max: 5000 });
  if (data.source !== undefined) out.source = optionalString(data.source, { max: 40 });
  return out;
}

export const CreateLearningRecordRequestDto = {
  from(body = {}) {
    const out = mapRecordBody(body);
    out.title = requireString(body.title, 'title', { min: 1, max: 300 });
    out.recordType = requireString(body.recordType || 'formation', 'recordType', {
      min: 1,
      max: 40,
    });
    return out;
  },
};

export const UpdateLearningRecordRequestDto = {
  from(body = {}) {
    return mapRecordBody(body);
  },
};

export const CreateFromAiRequestDto = {
  from(body = {}) {
    const training =
      body.training && typeof body.training === 'object' && !Array.isArray(body.training)
        ? pick(body.training, [
            'title',
            'organization',
            'level',
            'field',
            'durationLabel',
            'description',
            'skills',
          ])
        : null;
    if (!training) {
      throw new AppError('Formation IA manquante', 400);
    }
    return {
      business: optionalString(body.business, { max: 300 }),
      training,
      projectId: optionalId(body.projectId, 'projectId'),
    };
  },
};

export const LearningRecordResponseDto = {
  from(record) {
    if (!record) return null;
    return pick(record, [
      'id',
      'userId',
      'projectId',
      'documentId',
      'recordType',
      'title',
      'organization',
      'status',
      'level',
      'field',
      'format',
      'startDate',
      'endDate',
      'durationLabel',
      'diplomaObtained',
      'skills',
      'description',
      'notes',
      'source',
      'aiSnapshot',
      'metadata',
      'createdAt',
      'updatedAt',
    ]);
  },
  fromMany(records) {
    return (records || []).map((r) => LearningRecordResponseDto.from(r));
  },
};

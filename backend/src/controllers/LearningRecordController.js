import {
  CreateFromAiRequestDto,
  CreateLearningRecordRequestDto,
  LearningRecordIdParamDto,
  LearningRecordResponseDto,
  ListLearningRecordsQueryDto,
  UpdateLearningRecordRequestDto,
} from '../dto/learningRecord.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createLearningRecordController({ learningRecordService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const query = ListLearningRecordsQueryDto.from(req.query);
      const records = await learningRecordService.list(req.user.id, query);
      successResponse(res, { records: LearningRecordResponseDto.fromMany(records) });
    }),

    getOne: asyncHandler(async (req, res) => {
      const { id } = LearningRecordIdParamDto.from(req.params);
      const record = await learningRecordService.get(req.user.id, id);
      successResponse(res, { record: LearningRecordResponseDto.from(record) });
    }),

    create: asyncHandler(async (req, res) => {
      const dto = CreateLearningRecordRequestDto.from(req.body);
      const record = await learningRecordService.create(req.user.id, dto);
      successResponse(res, { record: LearningRecordResponseDto.from(record) }, 201);
    }),

    createFromAi: asyncHandler(async (req, res) => {
      const dto = CreateFromAiRequestDto.from(req.body);
      const record = await learningRecordService.createFromAiSuggestion(req.user.id, dto);
      successResponse(res, { record: LearningRecordResponseDto.from(record) }, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = LearningRecordIdParamDto.from(req.params);
      const dto = UpdateLearningRecordRequestDto.from(req.body);
      const record = await learningRecordService.update(req.user.id, id, dto);
      successResponse(res, { record: LearningRecordResponseDto.from(record) });
    }),

    remove: asyncHandler(async (req, res) => {
      const { id } = LearningRecordIdParamDto.from(req.params);
      await learningRecordService.remove(req.user.id, id);
      successResponse(res, { ok: true });
    }),
  };
}

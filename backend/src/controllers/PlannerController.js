import {
  CreatePlannerEventRequestDto,
  ListPlannerEventsQueryDto,
  PlannerEventIdParamDto,
  PlannerEventResponseDto,
  UpdatePlannerEventRequestDto,
} from '../dto/planner.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createPlannerController({ plannerService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const query = ListPlannerEventsQueryDto.from(req.query);
      const events = await plannerService.list(req.user.id, query);
      successResponse(res, PlannerEventResponseDto.fromMany(events));
    }),

    getOne: asyncHandler(async (req, res) => {
      const { id } = PlannerEventIdParamDto.from(req.params);
      const event = await plannerService.getOwned(req.user.id, id);
      successResponse(res, { event: PlannerEventResponseDto.from(event) });
    }),

    create: asyncHandler(async (req, res) => {
      const dto = CreatePlannerEventRequestDto.from(req.body);
      const event = await plannerService.create(req.user.id, dto);
      successResponse(res, { event: PlannerEventResponseDto.from(event) }, 201);
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = PlannerEventIdParamDto.from(req.params);
      const dto = UpdatePlannerEventRequestDto.from(req.body);
      const event = await plannerService.update(req.user.id, id, dto);
      successResponse(res, { event: PlannerEventResponseDto.from(event) });
    }),

    remove: asyncHandler(async (req, res) => {
      const { id } = PlannerEventIdParamDto.from(req.params);
      await plannerService.remove(req.user.id, id);
      successResponse(res, { message: 'Événement supprimé' });
    }),
  };
}

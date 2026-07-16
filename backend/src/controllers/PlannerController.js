import { PlannerService } from '../services/PlannerService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const PlannerController = {
  list: asyncHandler(async (req, res) => {
    const events = await PlannerService.list(req.user.id, {
      from: req.query.from,
      to: req.query.to,
    });
    successResponse(res, events);
  }),

  getOne: asyncHandler(async (req, res) => {
    const event = await PlannerService.getOwned(req.user.id, req.params.id);
    successResponse(res, { event });
  }),

  create: asyncHandler(async (req, res) => {
    const event = await PlannerService.create(req.user.id, req.body);
    successResponse(res, { event }, 201);
  }),

  update: asyncHandler(async (req, res) => {
    const event = await PlannerService.update(req.user.id, req.params.id, req.body);
    successResponse(res, { event });
  }),

  remove: asyncHandler(async (req, res) => {
    await PlannerService.remove(req.user.id, req.params.id);
    successResponse(res, { message: 'Événement supprimé' });
  }),
};

import { ProjectService } from '../services/ProjectService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const ProjectController = {
  create: asyncHandler(async (req, res) => {
    const { quoi, ou, budget, currency } = req.body;

    const project = await ProjectService.startProject({
      userId: req.user?.id,
      quoi,
      ou,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
    });

    successResponse(res, { project }, 201);
  }),

  getMine: asyncHandler(async (req, res) => {
    const projects = await ProjectService.getUserProjects(req.user.id);
    successResponse(res, projects);
  }),
};

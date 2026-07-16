import { ProjectService } from '../services/ProjectService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const ProjectController = {
  preview: asyncHandler(async (req, res) => {
    const { quoi, ou, budget, currency } = req.body;

    const preview = await ProjectService.previewProject({
      quoi,
      ou,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
    });

    successResponse(res, { preview });
  }),

  searchBusinesses: asyncHandler(async (req, res) => {
    const { quoi, ou, budget, currency, refine, avoid } = req.body;
    const businesses = await ProjectService.searchBusinesses({
      quoi,
      ou,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
      refine,
      avoid,
    });
    successResponse(res, { businesses });
  }),

  searchLocations: asyncHandler(async (req, res) => {
    const {
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      ou,
      budget,
      currency,
      refine,
      avoid,
    } = req.body;
    const locations = await ProjectService.searchLocations({
      business,
      businessActivity,
      businessPitch,
      businessRationale,
      ou,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
      refine,
      avoid,
    });
    successResponse(res, { locations });
  }),

  buildProposals: asyncHandler(async (req, res) => {
    const { business, location, budget, currency, refine } = req.body;
    const { proposals, assessment } = await ProjectService.buildProposals({
      business,
      location,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
      refine,
    });
    successResponse(res, { proposals, assessment });
  }),

  create: asyncHandler(async (req, res) => {
    const { quoi, ou, budget, currency, title, report, sections } = req.body;

    const project = await ProjectService.startProject({
      user: req.user,
      quoi,
      ou,
      budget: budget === '' || budget === undefined ? null : budget,
      currency: currency || 'EUR',
      title,
      report,
      sections,
    });

    successResponse(res, { project }, 201);
  }),

  getMine: asyncHandler(async (req, res) => {
    const projects = await ProjectService.getUserProjects(req.user.id);
    successResponse(res, projects);
  }),

  getOne: asyncHandler(async (req, res) => {
    const project = await ProjectService.getUserProject(req.user.id, req.params.id);
    successResponse(res, { project });
  }),

  update: asyncHandler(async (req, res) => {
    const { title, status, stage, legalForm, description } = req.body;
    const project = await ProjectService.updateProject(req.user.id, req.params.id, {
      title,
      status,
      stage,
      legalForm,
      description,
    });
    successResponse(res, { project });
  }),
};

import {
  BuildProposalsRequestDto,
  CreateProjectRequestDto,
  ProjectIdParamDto,
  ProjectPreviewRequestDto,
  ProjectResponseDto,
  SearchBusinessesRequestDto,
  SearchLocationsRequestDto,
  SearchTrainingsRequestDto,
  UpdateProjectLocationRequestDto,
  UpdateProjectRequestDto,
} from '../dto/project.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createProjectController({ projectService }) {
  function withUserContext(dto, req) {
    return {
      ...dto,
      userId: req.user?.id || null,
      projectId: dto.projectId ?? null,
    };
  }

  return {
    preview: asyncHandler(async (req, res) => {
      const dto = ProjectPreviewRequestDto.from(req.body);
      const preview = await projectService.previewProject(withUserContext(dto, req));
      successResponse(res, { preview });
    }),

    searchBusinesses: asyncHandler(async (req, res) => {
      const dto = SearchBusinessesRequestDto.from(req.body);
      const businesses = await projectService.searchBusinesses(withUserContext(dto, req));
      successResponse(res, { businesses });
    }),

    searchTrainings: asyncHandler(async (req, res) => {
      const dto = SearchTrainingsRequestDto.from(req.body);
      const trainings = await projectService.searchTrainings(withUserContext(dto, req));
      successResponse(res, { trainings });
    }),

    searchLocations: asyncHandler(async (req, res) => {
      const dto = SearchLocationsRequestDto.from(req.body);
      const locations = await projectService.searchLocations(withUserContext(dto, req));
      successResponse(res, { locations });
    }),

    buildProposals: asyncHandler(async (req, res) => {
      const dto = BuildProposalsRequestDto.from(req.body);
      const { proposals, assessment } = await projectService.buildProposals(
        withUserContext(dto, req)
      );
      successResponse(res, { proposals, assessment });
    }),

    create: asyncHandler(async (req, res) => {
      const dto = CreateProjectRequestDto.from(req.body);
      const project = await projectService.startProject({
        user: req.user,
        ...dto,
      });
      successResponse(res, { project: ProjectResponseDto.from(project) }, 201);
    }),

    getMine: asyncHandler(async (req, res) => {
      const projects = await projectService.getUserProjects(req.user.id);
      successResponse(res, ProjectResponseDto.fromMany(projects));
    }),

    getOne: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const project = await projectService.getUserProject(req.user.id, id);
      successResponse(res, { project: ProjectResponseDto.from(project) });
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const dto = UpdateProjectRequestDto.from(req.body);
      const project = await projectService.updateProject(req.user.id, id, dto);
      successResponse(res, { project: ProjectResponseDto.from(project) });
    }),

    updateLocation: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const dto = UpdateProjectLocationRequestDto.from(req.body);
      const project = await projectService.updateProjectLocation(req.user.id, id, dto);
      successResponse(res, { project: ProjectResponseDto.from(project) });
    }),

    recallSituation: asyncHandler(async (req, res) => {
      const intent =
        typeof req.body?.intent === 'string' ? req.body.intent.trim().slice(0, 500) : '';
      const situation = await projectService.getSituationSummary(req.user.id, { intent });
      successResponse(res, { situation });
    }),

    recallSituationForProject: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const intent =
        typeof req.body?.intent === 'string' ? req.body.intent.trim().slice(0, 500) : '';
      const situation = await projectService.getSituationSummary(req.user.id, {
        projectId: id,
        intent,
      });
      successResponse(res, { situation });
    }),

    scanMemory: asyncHandler(async (req, res) => {
      const result = await projectService.scanProjectMemory(req.user.id);
      successResponse(res, { scan: result });
    }),

    scanMemoryForProject: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const result = await projectService.scanProjectMemory(req.user.id, { projectId: id });
      successResponse(res, { scan: result });
    }),

    getTimeline: asyncHandler(async (req, res) => {
      const limit = req.query?.limit != null ? Number(req.query.limit) : 200;
      const timeline = await projectService.getTimeline(req.user.id, { limit });
      successResponse(res, { timeline });
    }),

    getTimelineForProject: asyncHandler(async (req, res) => {
      const { id } = ProjectIdParamDto.from(req.params);
      const limit = req.query?.limit != null ? Number(req.query.limit) : 200;
      const timeline = await projectService.getTimeline(req.user.id, {
        projectId: id,
        limit,
      });
      successResponse(res, { timeline });
    }),
  };
}

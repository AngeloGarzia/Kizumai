import {
  CreateStageContactRequestDto,
  CreateStageLinkRequestDto,
  StageLinkParamDto,
  StageMilestoneParamDto,
  StageParamDto,
  StageTaskParamDto,
  UpdateStageMilestoneRequestDto,
  UpdateStageTaskRequestDto,
} from '../dto/projectStage.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createProjectStageController({ projectStageService }) {
  return {
    getOrCreate: asyncHandler(async (req, res) => {
      const { projectId, stage } = StageParamDto.from(req.params);
      const data = await projectStageService.getOrCreate(req.user.id, projectId, stage);
      successResponse(res, data);
    }),

    updateTask: asyncHandler(async (req, res) => {
      const { projectId, stage, taskId } = StageTaskParamDto.from(req.params);
      const dto = UpdateStageTaskRequestDto.from(req.body);
      const data = await projectStageService.updateTask(
        req.user.id,
        projectId,
        stage,
        taskId,
        dto
      );
      successResponse(res, data);
    }),

    addLink: asyncHandler(async (req, res) => {
      const { projectId, stage } = StageParamDto.from(req.params);
      const dto = CreateStageLinkRequestDto.from(req.body);
      const data = await projectStageService.addLink(req.user.id, projectId, stage, dto);
      successResponse(res, data, 201);
    }),

    removeLink: asyncHandler(async (req, res) => {
      const { projectId, stage, linkId } = StageLinkParamDto.from(req.params);
      const data = await projectStageService.removeLink(
        req.user.id,
        projectId,
        stage,
        linkId
      );
      successResponse(res, data);
    }),

    createContact: asyncHandler(async (req, res) => {
      const { projectId, stage } = StageParamDto.from(req.params);
      const dto = CreateStageContactRequestDto.from(req.body);
      const data = await projectStageService.createContactAndLink(
        req.user.id,
        projectId,
        stage,
        dto
      );
      successResponse(res, data, 201);
    }),

    updateMilestone: asyncHandler(async (req, res) => {
      const { projectId, stage, milestoneId } = StageMilestoneParamDto.from(req.params);
      const dto = UpdateStageMilestoneRequestDto.from(req.body);
      const data = await projectStageService.updateMilestone(
        req.user.id,
        projectId,
        stage,
        milestoneId,
        dto
      );
      successResponse(res, data);
    }),
  };
}

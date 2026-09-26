import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';
import { enqueueAssistantCheckup } from '../queue/assistantQueue.js';

export function createProjectAssistantController({ projectAssistantService }) {
  return {
    listInsights: asyncHandler(async (req, res) => {
      const data = await projectAssistantService.listInsights(
        req.user.id,
        req.params.id
      );
      successResponse(res, data);
    }),

    updateInsight: asyncHandler(async (req, res) => {
      const status = String(req.body?.status || '').trim();
      const insight = await projectAssistantService.updateInsight(
        req.user.id,
        req.params.id,
        req.params.insightId,
        status
      );
      successResponse(res, { insight });
    }),

    requestCheckup: asyncHandler(async (req, res) => {
      const projectId = Number(req.params.id);
      await enqueueAssistantCheckup({ projectId });
      successResponse(res, { queued: true, projectId });
    }),
  };
}

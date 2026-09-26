import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createProjectReorientationController({ projectReorientationService }) {
  return {
    getLatest: asyncHandler(async (req, res) => {
      const data = await projectReorientationService.getLatest(
        req.user.id,
        req.params.id
      );
      successResponse(res, data);
    }),

    getOne: asyncHandler(async (req, res) => {
      const data = await projectReorientationService.getReview(
        req.user.id,
        req.params.id,
        req.params.reviewId
      );
      successResponse(res, data);
    }),

    request: asyncHandler(async (req, res) => {
      const data = await projectReorientationService.enqueueReview({
        userId: req.user.id,
        projectId: req.params.id,
        triggerSource: 'manual',
        force: req.body?.force === true,
      });
      successResponse(res, data);
    }),

    apply: asyncHandler(async (req, res) => {
      const data = await projectReorientationService.applyReview(
        req.user.id,
        req.params.id,
        req.params.reviewId,
        {
          acceptItemIds: req.body?.acceptItemIds || [],
          rejectItemIds: req.body?.rejectItemIds || [],
        }
      );
      successResponse(res, data);
    }),

    dismiss: asyncHandler(async (req, res) => {
      const data = await projectReorientationService.dismissReview(
        req.user.id,
        req.params.id,
        req.params.reviewId
      );
      successResponse(res, data);
    }),
  };
}

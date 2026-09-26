import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createProjectAuditController({ projectAuditService }) {
  return {
    start: asyncHandler(async (req, res) => {
      const data = await projectAuditService.startAudit(req.user.id, req.params.id);
      successResponse(res, data);
    }),

    getLatest: asyncHandler(async (req, res) => {
      const data = await projectAuditService.getLatest(req.user.id, req.params.id);
      successResponse(res, data);
    }),

    getOne: asyncHandler(async (req, res) => {
      const data = await projectAuditService.getAudit(
        req.user.id,
        req.params.id,
        req.params.auditId
      );
      successResponse(res, data);
    }),

    apply: asyncHandler(async (req, res) => {
      const data = await projectAuditService.applyAudit(
        req.user.id,
        req.params.id,
        req.params.auditId,
        {
          acceptItemIds: req.body?.acceptItemIds || [],
          rejectItemIds: req.body?.rejectItemIds || [],
        }
      );
      successResponse(res, data);
    }),

    dismiss: asyncHandler(async (req, res) => {
      const data = await projectAuditService.dismissAudit(
        req.user.id,
        req.params.id,
        req.params.auditId
      );
      successResponse(res, data);
    }),
  };
}

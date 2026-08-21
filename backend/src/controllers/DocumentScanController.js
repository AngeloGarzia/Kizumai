import {
  ApplyScanRequestDto,
  DocumentScanParamsDto,
  ScanParamsDto,
} from '../dto/documentScan.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createDocumentScanController({ documentScanService }) {
  return {
    getOne: asyncHandler(async (req, res) => {
      const { projectId, scanId } = ScanParamsDto.from(req.params);
      const data = await documentScanService.getScan(req.user.id, projectId, scanId);
      successResponse(res, data);
    }),

    getLatest: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentScanParamsDto.from(req.params);
      const data = await documentScanService.getLatestForDocument(
        req.user.id,
        projectId,
        documentId
      );
      successResponse(res, data);
    }),

    retry: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentScanParamsDto.from(req.params);
      const scan = await documentScanService.startScan({
        userId: req.user.id,
        projectId,
        documentId,
      });
      successResponse(res, { scan }, 201);
    }),

    apply: asyncHandler(async (req, res) => {
      const { projectId, scanId } = ScanParamsDto.from(req.params);
      const dto = ApplyScanRequestDto.from(req.body);
      const data = await documentScanService.applyScan(req.user.id, projectId, scanId, dto);
      successResponse(res, data);
    }),

    dismiss: asyncHandler(async (req, res) => {
      const { projectId, scanId } = ScanParamsDto.from(req.params);
      const data = await documentScanService.dismissScan(req.user.id, projectId, scanId);
      successResponse(res, data);
    }),
  };
}

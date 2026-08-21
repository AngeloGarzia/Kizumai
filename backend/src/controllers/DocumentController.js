import {
  DocumentContactParamsDto,
  DocumentParamsDto,
  DocumentResponseDto,
  LinkDocumentContactRequestDto,
  UpdateDocumentRequestDto,
  UploadDocumentRequestDto,
} from '../dto/document.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';
import {
  buildContentDisposition,
  safeDownloadMime,
  shouldInlineDownload,
} from '../services/DocumentFormat.js';

export function createDocumentController({ documentService, storageService }) {
  return {
    upload: asyncHandler(async (req, res) => {
      const { projectId } = DocumentParamsDto.from(req.params);
      const dto = UploadDocumentRequestDto.from(req.body, req.file);
      const document = await documentService.addDocument({
        userId: req.user.id,
        projectId,
        file: dto.file,
        title: dto.title,
        categoryId: dto.categoryId,
        description: dto.description,
      });
      successResponse(res, { document: DocumentResponseDto.from(document) }, 201);
    }),

    list: asyncHandler(async (req, res) => {
      const { projectId } = DocumentParamsDto.from(req.params);
      const documents = await documentService.listDocuments({
        userId: req.user.id,
        projectId,
      });
      successResponse(res, DocumentResponseDto.fromMany(documents));
    }),

    listResources: asyncHandler(async (req, res) => {
      const { projectId } = DocumentParamsDto.from(req.params);
      const data = await documentService.listResources({
        userId: req.user.id,
        projectId,
      });
      successResponse(res, data);
    }),

    listCategories: asyncHandler(async (req, res) => {
      const categories = await documentService.listCategories();
      successResponse(res, { categories });
    }),

    getOne: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      const document = await documentService.getDocumentDetail({
        userId: req.user.id,
        projectId,
        documentId,
      });
      successResponse(res, { document: DocumentResponseDto.from(document) });
    }),

    update: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      const dto = UpdateDocumentRequestDto.from(req.body);
      const document = await documentService.updateDocument({
        userId: req.user.id,
        projectId,
        documentId,
        fields: dto,
      });
      successResponse(res, { document: DocumentResponseDto.from(document) });
    }),

    textPreview: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      const preview = await documentService.getTextPreview({
        userId: req.user.id,
        projectId,
        documentId,
      });
      successResponse(res, preview);
    }),

    linkContact: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      const dto = LinkDocumentContactRequestDto.from(req.body);
      const document = await documentService.linkContact({
        userId: req.user.id,
        projectId,
        documentId,
        contactId: dto.contactId,
        role: dto.role,
        note: dto.note,
      });
      successResponse(res, { document: DocumentResponseDto.from(document) });
    }),

    unlinkContact: asyncHandler(async (req, res) => {
      const { projectId, documentId, contactId } = DocumentContactParamsDto.from(req.params);
      const document = await documentService.unlinkContact({
        userId: req.user.id,
        projectId,
        documentId,
        contactId,
      });
      successResponse(res, { document: DocumentResponseDto.from(document) });
    }),

    download: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      const { doc, buffer } = await documentService.getDocumentBytes({
        userId: req.user.id,
        projectId,
        documentId,
      });

      const mime = safeDownloadMime(doc.mimeType);
      const inline = shouldInlineDownload(mime);

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      res.type(mime);
      res.setHeader(
        'Content-Disposition',
        buildContentDisposition(doc.fileName, { inline })
      );
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    }),

    remove: asyncHandler(async (req, res) => {
      const { projectId, documentId } = DocumentParamsDto.from(req.params);
      await documentService.deleteDocument({
        userId: req.user.id,
        projectId,
        documentId,
      });
      successResponse(res, { message: 'Document supprimé' });
    }),
  };
}

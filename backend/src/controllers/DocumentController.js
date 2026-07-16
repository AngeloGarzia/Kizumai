import { DocumentService } from '../services/DocumentService.js';
import { StorageService } from '../services/StorageService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const DocumentController = {
  upload: asyncHandler(async (req, res) => {
    const document = await DocumentService.addDocument({
      userId: req.user.id,
      projectId: req.params.id,
      file: req.file,
      title: req.body.title,
    });
    successResponse(res, { document }, 201);
  }),

  list: asyncHandler(async (req, res) => {
    const documents = await DocumentService.listDocuments({
      userId: req.user.id,
      projectId: req.params.id,
    });
    successResponse(res, documents);
  }),

  download: asyncHandler(async (req, res) => {
    const doc = await DocumentService.getDocumentForUser({
      userId: req.user.id,
      projectId: req.params.id,
      documentId: req.params.docId,
    });

    if (doc.mimeType) res.type(doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    StorageService.createReadStream(doc.storageKey).pipe(res);
  }),

  remove: asyncHandler(async (req, res) => {
    await DocumentService.deleteDocument({
      userId: req.user.id,
      projectId: req.params.id,
      documentId: req.params.docId,
    });
    successResponse(res, { message: 'Document supprimé' });
  }),
};

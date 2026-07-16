import { DocumentModel } from '../models/DocumentModel.js';
import { ProjectService } from './ProjectService.js';
import { StorageService } from './StorageService.js';
import { toStorageKey } from '../middleware/upload.js';
import { AppError } from '../utils/AppError.js';

function detectType(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return 'spreadsheet';
  if (mimeType.includes('word') || mimeType === 'application/msword') return 'document';
  return 'other';
}

export const DocumentService = {
  async addDocument({ userId, projectId, file, title }) {
    if (!file) throw new AppError('Aucun fichier reçu', 400);

    // Vérifie que le projet appartient bien à l'utilisateur.
    await ProjectService.getUserProject(userId, projectId);

    return DocumentModel.create({
      projectId,
      uploadedBy: userId,
      type: detectType(file.mimetype),
      title: title || file.originalname,
      fileName: file.originalname,
      storageKey: toStorageKey(file.path),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  },

  async listDocuments({ userId, projectId }) {
    await ProjectService.getUserProject(userId, projectId);
    return DocumentModel.findByProjectId(projectId);
  },

  async getDocumentForUser({ userId, projectId, documentId }) {
    await ProjectService.getUserProject(userId, projectId);
    const doc = await DocumentModel.findById(documentId);
    if (!doc || doc.projectId !== Number(projectId)) {
      throw new AppError('Document introuvable', 404);
    }
    return doc;
  },

  async deleteDocument({ userId, projectId, documentId }) {
    const doc = await this.getDocumentForUser({ userId, projectId, documentId });
    await StorageService.remove(doc.storageKey);
    await DocumentModel.delete(doc.id);
    return true;
  },
};

import { readFile } from 'fs/promises';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';
import { makeStorageKey } from '../middleware/upload.js';
import { enqueueDocumentExtract } from '../queue/documentQueue.js';
import {
  assertAllowedUploadFormat,
  resolveUploadedFileFormat,
  safeDownloadMime,
} from './DocumentFormat.js';
import { detectDocumentType } from './DocumentTextExtractor.js';

function canPreviewInline(doc) {
  if (!doc?.mimeType && !doc?.fileName) return false;
  const mime = safeDownloadMime(doc.mimeType);
  return (
    mime === 'application/pdf' ||
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/webp' ||
    mime === 'image/gif'
  );
}

function processingStatusOf(doc) {
  const status = doc?.attributes?.processingStatus;
  if (status) return status;
  if (doc?.excerpt) return 'ready';
  return null;
}

function groupByCategory(documents, categories) {
  const byId = new Map(categories.map((c) => [c.id, { ...c, documents: [] }]));
  const uncategorized = [];

  for (const doc of documents) {
    if (doc.categoryId && byId.has(doc.categoryId)) {
      byId.get(doc.categoryId).documents.push(doc);
    } else if (doc.category?.parentId && byId.has(doc.category.parentId)) {
      byId.get(doc.category.parentId).documents.push(doc);
    } else {
      uncategorized.push(doc);
    }
  }

  const grouped = [...byId.values()]
    .filter((c) => !c.parentId)
    .map((parent) => ({
      ...parent,
      children: [...byId.values()]
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { categories: grouped, uncategorized };
}

export function createDocumentService({
  documentRepository,
  projectService,
  storageService,
  resourceCategoryRepository,
  contactLinkRepository,
  contactRepository,
  documentScanService,
  projectMemoryUpdateService = null,
}) {
  async function resolveDocumentBuffer(doc) {
    const row = await documentRepository.findContentById(doc.id);
    if (row?.content?.length) {
      return row.content;
    }

    if (doc.storageKey) {
      try {
        const abs = storageService.absolutePath(doc.storageKey);
        const buf = await readFile(abs);
        if (buf?.length) {
          await documentRepository.updateContent(doc.id, buf, buf.length).catch(() => {});
          return buf;
        }
      } catch {
        /* ignore */
      }
    }

    throw new AppError('Contenu du fichier introuvable en base', 404);
  }

  return {
    async addDocument({ userId, projectId, file, title, categoryId, description }) {
      if (!file) throw new AppError('Aucun fichier reçu', 400);
      if (!file.buffer?.length) {
        throw new AppError('Fichier vide ou non reçu en mémoire', 400);
      }
      const buffer = file.buffer;
      await projectService.getUserProject(userId, projectId);

      if (
        (file.size && file.size > config.storage.maxFileSizeBytes) ||
        buffer.length > config.storage.maxFileSizeBytes
      ) {
        throw new AppError('Fichier trop volumineux', 413);
      }

      const usage = await documentRepository.getProjectQuotaUsage(projectId);
      if (usage.count >= config.storage.maxDocumentsPerProject) {
        throw new AppError('Quota de documents atteint pour ce projet', 413);
      }
      if (usage.totalBytes + buffer.length > config.storage.maxProjectStorageBytes) {
        throw new AppError('Quota de stockage atteint pour ce projet', 413);
      }

      let resolvedCategoryId = categoryId ? Number(categoryId) : null;
      if (resolvedCategoryId) {
        const cat = await resourceCategoryRepository.findById(resolvedCategoryId);
        if (!cat) throw new AppError('Catégorie introuvable', 400);
      }

      const storageKey = makeStorageKey(projectId, file.originalname);

      const rawFormat = await resolveUploadedFileFormat({
        buffer,
        originalName: file.originalname,
      });
      const format = assertAllowedUploadFormat(rawFormat, {
        originalName: file.originalname,
        buffer,
      });
      const mimeType = format.mimeType;

      const doc = await documentRepository.create({
        projectId,
        uploadedBy: userId,
        type: detectDocumentType(mimeType, file.originalname),
        title: title || file.originalname,
        fileName: file.originalname,
        storageKey,
        mimeType,
        sizeBytes: buffer.length,
        categoryId: resolvedCategoryId,
        description: description || null,
        excerpt: null,
        content: buffer,
        attributes: {
          processingStatus: 'processing',
          processingError: null,
        },
      });

      await enqueueDocumentExtract({ documentId: doc.id }).catch((err) => {
        console.warn('[documents] enqueue extract :', err.message);
      });

      let scan = null;
      if (documentScanService && process.env.DOCUMENT_AUTO_SCAN === 'true') {
        try {
          scan = await documentScanService.startScan({
            userId,
            projectId,
            documentId: doc.id,
          });
        } catch (err) {
          console.warn('[documents] démarrage scan IA :', err.message);
        }
      }

      if (projectMemoryUpdateService) {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'fact',
          content: [
            `Document ajouté : ${doc.title || doc.fileName}`,
            doc.type ? `type ${doc.type}` : null,
            doc.category?.title ? `catégorie ${doc.category.title}` : null,
          ]
            .filter(Boolean)
            .join(' — '),
          sourceEntityType: 'document',
          sourceEntityId: doc.id,
          importance: 0.55,
        });
      }

      return {
        ...doc,
        processingStatus: 'processing',
        scanId: scan?.id ?? null,
        scanStatus: scan?.status ?? null,
      };
    },

    async getDocumentBytes({ userId, projectId, documentId }) {
      const doc = await this.getDocumentForUser({ userId, projectId, documentId });
      const buffer = await resolveDocumentBuffer(doc);
      return { doc, buffer };
    },

    async listDocuments({ userId, projectId }) {
      await projectService.getUserProject(userId, projectId);
      return documentRepository.findByProjectId(projectId);
    },

    async listResources({ userId, projectId }) {
      await projectService.getUserProject(userId, projectId);
      const [documents, categories] = await Promise.all([
        documentRepository.findByProjectId(projectId),
        resourceCategoryRepository.listActive(),
      ]);

      const enriched = [];
      for (const doc of documents) {
        const contacts = await contactLinkRepository.findContactsForEntity('document', doc.id);
        enriched.push({
          ...doc,
          processingStatus: processingStatusOf(doc),
          previewable: canPreviewInline(doc),
          contacts,
        });
      }

      const projectContacts = (await contactRepository.findByUserId(userId)).filter(
        (c) => c.projectId == null || c.projectId === Number(projectId)
      );

      const grouped = groupByCategory(enriched, categories);
      return {
        ...grouped,
        documents: enriched,
        projectContacts,
        total: enriched.length,
      };
    },

    async getDocumentForUser({ userId, projectId, documentId }) {
      await projectService.getUserProject(userId, projectId);
      const doc = await documentRepository.findById(documentId);
      if (!doc || doc.projectId !== Number(projectId)) {
        throw new AppError('Document introuvable', 404);
      }
      return doc;
    },

    async getDocumentDetail({ userId, projectId, documentId }) {
      const doc = await this.getDocumentForUser({ userId, projectId, documentId });
      const contacts = await contactLinkRepository.findContactsForEntity('document', doc.id);
      return {
        ...doc,
        processingStatus: processingStatusOf(doc),
        previewable: canPreviewInline(doc),
        contacts,
      };
    },

    async updateDocument({ userId, projectId, documentId, fields }) {
      await this.getDocumentForUser({ userId, projectId, documentId });
      if (fields.categoryId != null) {
        const cat = await resourceCategoryRepository.findById(fields.categoryId);
        if (!cat) throw new AppError('Catégorie introuvable', 400);
      }
      const updated = await documentRepository.update(documentId, fields);
      const contacts = await contactLinkRepository.findContactsForEntity('document', documentId);
      return {
        ...updated,
        processingStatus: processingStatusOf(updated),
        previewable: canPreviewInline(updated),
        contacts,
      };
    },

    async linkContact({ userId, projectId, documentId, contactId, role, note }) {
      await this.getDocumentForUser({ userId, projectId, documentId });
      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.userId !== Number(userId)) {
        throw new AppError('Contact introuvable', 404);
      }
      if (
        contact.projectId != null &&
        Number(contact.projectId) !== Number(projectId)
      ) {
        throw new AppError('Contact hors périmètre du projet', 400);
      }
      await contactLinkRepository.link({
        contactId,
        entityType: 'document',
        entityId: documentId,
        role: role || 'lié',
        note: note || null,
      });
      return this.getDocumentDetail({ userId, projectId, documentId });
    },

    async unlinkContact({ userId, projectId, documentId, contactId }) {
      await this.getDocumentForUser({ userId, projectId, documentId });
      const links = await contactLinkRepository.findByContactId(contactId);
      const link = links.find(
        (l) => l.entityType === 'document' && l.entityId === Number(documentId)
      );
      if (!link) throw new AppError('Lien introuvable', 404);
      await contactLinkRepository.unlink(link.id);
      return this.getDocumentDetail({ userId, projectId, documentId });
    },

    async getTextPreview({ userId, projectId, documentId }) {
      const doc = await this.getDocumentForUser({ userId, projectId, documentId });
      const status = processingStatusOf(doc);

      if (doc.excerpt) {
        return { status: 'ready', text: doc.excerpt, truncated: true };
      }
      if (status === 'processing') {
        return {
          status: 'processing',
          text: null,
          message: 'Extraction en cours…',
        };
      }
      if (status === 'failed') {
        throw new AppError(
          doc.attributes?.processingError || 'Aperçu texte non disponible pour ce fichier',
          400
        );
      }

      return {
        status: 'processing',
        text: null,
        message: 'Extraction en cours…',
      };
    },

    async deleteDocument({ userId, projectId, documentId }) {
      const doc = await this.getDocumentForUser({ userId, projectId, documentId });
      if (doc.storageKey) {
        await storageService.remove(doc.storageKey).catch(() => {});
      }
      await documentRepository.delete(doc.id);
      return true;
    },

    async listCategories() {
      return resourceCategoryRepository.listActive();
    },

    resolveDocumentBuffer,
  };
}

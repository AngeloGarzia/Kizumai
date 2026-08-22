import { readFile } from 'fs/promises';
import { withTempFile } from '../utils/tempFile.js';
import { extractDocumentText } from '../services/DocumentTextExtractor.js';
import { DocumentProcessingError, DOCUMENT_LIMITS } from '../services/documentProcessingLimits.js';

function mergeAttributes(doc, patch) {
  return { ...(doc.attributes || {}), ...patch };
}

async function loadDocumentBuffer(doc, documentRepository, storageService) {
  const row = await documentRepository.findContentById(doc.id);
  if (row?.content?.length) return row.content;
  if (doc.storageKey && storageService) {
    const abs = storageService.absolutePath(doc.storageKey);
    return readFile(abs);
  }
  throw new Error('Contenu du document introuvable');
}

/**
 * Factory — processeur partagé worker BullMQ / file locale.
 */
export function createDocumentJobProcessor({
  documentRepository,
  documentScanService,
  storageService,
}) {
  async function runExtract({ documentId }) {
    const doc = await documentRepository.findById(documentId);
    if (!doc) return;

    await documentRepository.update(documentId, {
      attributes: mergeAttributes(doc, {
        processingStatus: 'processing',
        processingError: null,
      }),
    });

    try {
      const buffer = await loadDocumentBuffer(doc, documentRepository, storageService);
      const text = await withTempFile(buffer, doc.fileName || 'file.bin', (abs) =>
        extractDocumentText(abs, {
          mimeType: doc.mimeType,
          fileName: doc.fileName || doc.title,
          limits: DOCUMENT_LIMITS,
        })
      );

      const excerpt = text.trim() ? text.slice(0, 2000) : null;
      const fresh = await documentRepository.findById(documentId);
      await documentRepository.update(documentId, {
        excerpt,
        attributes: mergeAttributes(fresh, {
          processingStatus: excerpt ? 'ready' : 'failed',
          processingError: excerpt ? null : 'Aucun texte extractible',
          extractedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      const message =
        err instanceof DocumentProcessingError ? err.message : 'Extraction impossible';
      const fresh = await documentRepository.findById(documentId);
      await documentRepository.update(documentId, {
        attributes: mergeAttributes(fresh, {
          processingStatus: 'failed',
          processingError: message,
          extractedAt: new Date().toISOString(),
        }),
      });
      throw err;
    }
  }

  async function runScan({ scanId }) {
    await documentScanService.processScan(scanId);
  }

  return async function processDocumentJob(job) {
    if (job.kind === 'extract' || job.name === 'document-extract') {
      await runExtract(job.data || job);
      return;
    }
    if (job.kind === 'scan' || job.name === 'document-scan') {
      await runScan(job.data || job);
      return;
    }
    console.warn('[doc-queue] Job inconnu ignoré');
  };
}

import { createDocumentJobProcessor } from './documentJobProcessor.js';
import { initDocumentJobProcessor } from './documentQueue.js';
import { startDocumentWorker, stopDocumentWorker } from './documentWorker.js';

/**
 * Démarre le traitement document (BullMQ ou file locale limitée).
 */
export function startDocumentProcessing(container) {
  const processor = createDocumentJobProcessor({
    documentRepository: container.repositories.documentRepository,
    documentScanService: container.services.documentScanService,
    storageService: container.services.storageService,
  });

  initDocumentJobProcessor(processor);
  startDocumentWorker(processor);
}

export async function stopDocumentProcessing() {
  await stopDocumentWorker();
}

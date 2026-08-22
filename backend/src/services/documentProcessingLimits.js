/**
 * Limites de traitement document (extract/OCR) — surchargeables via env.
 */
export const DOCUMENT_LIMITS = {
  /** Timeout global par job d'extraction (ms). */
  jobTimeoutMs: Number(process.env.DOCUMENT_JOB_TIMEOUT_MS) || 120_000,
  /** Pages PDF max. */
  pdfMaxPages: Number(process.env.DOCUMENT_PDF_MAX_PAGES) || 80,
  /** Taille max lue pour PDF (octets). */
  pdfMaxBytes: Number(process.env.DOCUMENT_PDF_MAX_BYTES) || 25 * 1024 * 1024,
  /** Entrées max dans une archive Office (ZIP). */
  zipMaxEntries: Number(process.env.DOCUMENT_ZIP_MAX_ENTRIES) || 500,
  /** Taille décompressée cumulée max (octets). */
  zipMaxUncompressedBytes:
    Number(process.env.DOCUMENT_ZIP_MAX_UNCOMPRESSED) || 120 * 1024 * 1024,
  /** Ratio décompression max (uncompressed / compressed). */
  zipMaxCompressionRatio: Number(process.env.DOCUMENT_ZIP_MAX_RATIO) || 200,
  /** Taille max d'un XML interne (octets) — heuristique via entry size. */
  zipMaxEntryUncompressedBytes:
    Number(process.env.DOCUMENT_ZIP_MAX_ENTRY) || 15 * 1024 * 1024,
  /** Pixels max pour OCR (largeur × hauteur). */
  ocrMaxPixels: Number(process.env.DOCUMENT_OCR_MAX_PIXELS) || 24_000_000,
  /** Taille max image pour OCR (octets). */
  ocrMaxBytes: Number(process.env.DOCUMENT_OCR_MAX_BYTES) || 12 * 1024 * 1024,
  /** Texte extrait max (caractères). */
  maxTextChars: Number(process.env.DOCUMENT_MAX_TEXT_CHARS) || 45_000,
  /** Concurrence worker documents. */
  workerConcurrency: Number(process.env.DOCUMENT_QUEUE_CONCURRENCY) || 2,
  /** Tentatives BullMQ. */
  jobAttempts: Number(process.env.DOCUMENT_JOB_ATTEMPTS) || 2,
};

export class DocumentProcessingError extends Error {
  constructor(message, code = 'processing_failed') {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
  }
}

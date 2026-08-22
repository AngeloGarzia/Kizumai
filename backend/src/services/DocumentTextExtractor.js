import { readFile } from 'fs/promises';
import path from 'path';
import officeParser from 'officeparser';
import Tesseract from 'tesseract.js';
import WordExtractor from 'word-extractor';
import { assertSafeZipBuffer } from '../utils/archiveGuard.js';
import { assertImageWithinOcrLimits, isZipBasedOfficeExt } from '../utils/imageLimits.js';
import { withProcessingTimeout } from '../utils/withProcessingTimeout.js';
import {
  DOCUMENT_LIMITS,
  DocumentProcessingError,
} from './documentProcessingLimits.js';

const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif',
]);

const OFFICE_EXTS = new Set([
  'docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'rtf', 'csv', 'md',
  'markdown', 'html', 'htm', 'epub',
]);

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'log',
  'yml', 'yaml', 'ini', 'conf', 'tex', 'rtf',
]);

const SPREADSHEET_EXTS = new Set(['xlsx', 'xls', 'ods', 'csv', 'tsv']);
const PRESENTATION_EXTS = new Set(['pptx', 'ppt', 'odp']);
const DOCUMENT_EXTS = new Set([
  'docx', 'doc', 'odt', 'rtf', 'md', 'markdown', 'txt', 'html', 'htm', 'epub',
]);

function extensionOf(fileName = '', absPath = '') {
  const base = fileName || absPath || '';
  return path.extname(base).replace(/^\./, '').toLowerCase();
}

function isOfficeMime(mime = '') {
  const m = mime.toLowerCase();
  return (
    m === 'application/pdf' ||
    m.includes('wordprocessingml') ||
    m.includes('spreadsheetml') ||
    m.includes('presentationml') ||
    m.includes('msword') ||
    m.includes('ms-excel') ||
    m.includes('ms-powerpoint') ||
    m.includes('opendocument') ||
    m === 'application/rtf' ||
    m === 'text/rtf' ||
    m === 'text/csv' ||
    m === 'text/markdown' ||
    m === 'text/html' ||
    m === 'application/epub+zip'
  );
}

export function detectDocumentType(mimeType, fileName) {
  const mime = (mimeType || '').toLowerCase();
  const ext = extensionOf(fileName);

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image';
  if (
    SPREADSHEET_EXTS.has(ext) ||
    mime.includes('spreadsheet') ||
    mime.includes('ms-excel') ||
    mime === 'text/csv'
  ) {
    return 'spreadsheet';
  }
  if (
    PRESENTATION_EXTS.has(ext) ||
    mime.includes('presentation') ||
    mime.includes('ms-powerpoint')
  ) {
    return 'presentation';
  }
  if (
    DOCUMENT_EXTS.has(ext) ||
    mime.includes('word') ||
    mime === 'application/msword' ||
    mime.startsWith('text/')
  ) {
    return 'document';
  }
  return 'other';
}

async function extractPdf(absPath, limits) {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pdfParse = require('pdf-parse');
  const buffer = await readFile(absPath);
  if (buffer.length > limits.pdfMaxBytes) {
    throw new DocumentProcessingError('PDF trop volumineux pour l\'extraction', 'pdf_too_large');
  }
  const parsed = await pdfParse(buffer, { max: limits.pdfMaxPages });
  if (parsed.numpages > limits.pdfMaxPages) {
    throw new DocumentProcessingError(
      `PDF : trop de pages (${parsed.numpages} > ${limits.pdfMaxPages})`,
      'pdf_too_many_pages'
    );
  }
  return String(parsed?.text || '').slice(0, limits.maxTextChars);
}

async function extractPlainText(absPath, limits) {
  const text = await readFile(absPath, 'utf8');
  return text.slice(0, limits.maxTextChars);
}

async function extractLegacyDoc(absPath, limits) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(absPath);
  return String(doc.getBody() || '').slice(0, limits.maxTextChars);
}

async function extractWithOfficeParser(absPath, ext, limits) {
  const buffer = await readFile(absPath);
  if (isZipBasedOfficeExt(ext) || ext === 'epub') {
    assertSafeZipBuffer(buffer, limits);
  }

  const ast = await officeParser.parseOffice(absPath, { extractAttachments: false });
  const out = await ast.to('text');
  return String(out?.value || '').slice(0, limits.maxTextChars);
}

async function extractImageOcr(absPath, limits) {
  const buffer = await readFile(absPath);
  assertImageWithinOcrLimits(buffer, limits);
  const result = await Tesseract.recognize(absPath, 'fra+eng', {
    logger: () => {},
  });
  return String(result?.data?.text || '').slice(0, limits.maxTextChars);
}

/**
 * Extraction de texte (worker / file d'attente uniquement — ne pas appeler depuis HTTP).
 */
export async function extractDocumentText(
  absPath,
  { mimeType = '', fileName = '', limits = DOCUMENT_LIMITS } = {}
) {
  const mime = (mimeType || '').toLowerCase();
  const ext = extensionOf(fileName, absPath);

  const run = async () => {
    if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) {
      return extractImageOcr(absPath, limits);
    }

    if (ext === 'pdf' || mime === 'application/pdf') {
      return extractPdf(absPath, limits);
    }

    if (ext === 'doc' || mime === 'application/msword') {
      if (ext === 'doc' || !mime.includes('openxml')) {
        try {
          return await extractLegacyDoc(absPath, limits);
        } catch (err) {
          console.warn('[text-extract] word-extractor:', err.message);
        }
      }
    }

    if (
      OFFICE_EXTS.has(ext) ||
      isOfficeMime(mime) ||
      ext === 'xls' ||
      ext === 'ppt'
    ) {
      return extractWithOfficeParser(absPath, ext, limits);
    }

    if (
      TEXT_EXTS.has(ext) ||
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml'
    ) {
      return extractPlainText(absPath, limits);
    }

    try {
      const text = await extractPlainText(absPath, limits);
      if (text && /[\p{L}\p{N}]/u.test(text.slice(0, 500))) {
        return text;
      }
    } catch {
      /* ignore */
    }

    return '';
  };

  return withProcessingTimeout(run(), limits.jobTimeoutMs, 'Extraction document');
}

export const SUPPORTED_EXTRACT_HINT =
  'Formats lus : PDF, Word (.doc/.docx), Excel, PowerPoint, OpenDocument, Markdown, HTML, CSV, RTF, images (OCR).';

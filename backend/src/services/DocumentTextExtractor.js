import { readFile } from 'fs/promises';
import path from 'path';
import officeParser from 'officeparser';
import Tesseract from 'tesseract.js';
import WordExtractor from 'word-extractor';

const MAX_TEXT = 45_000;

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

/**
 * Classifie le fichier pour la colonne documents.type (STI).
 */
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

async function extractPdf(absPath) {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pdfParse = require('pdf-parse');
  const buffer = await readFile(absPath);
  const parsed = await pdfParse(buffer);
  return String(parsed?.text || '').slice(0, MAX_TEXT);
}

async function extractPlainText(absPath) {
  const text = await readFile(absPath, 'utf8');
  return text.slice(0, MAX_TEXT);
}

async function extractLegacyDoc(absPath) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(absPath);
  return String(doc.getBody() || '').slice(0, MAX_TEXT);
}

async function extractWithOfficeParser(absPath, { withOcr = false } = {}) {
  const config = withOcr
    ? {
        extractAttachments: false,
        ocr: true,
        ocrConfig: {
          language: 'fra+eng',
        },
      }
    : { extractAttachments: false };

  const ast = await officeParser.parseOffice(absPath, config);
  const out = await ast.to('text');
  return String(out?.value || '').slice(0, MAX_TEXT);
}

async function extractImageOcr(absPath) {
  const result = await Tesseract.recognize(absPath, 'fra+eng', {
    logger: () => {},
  });
  return String(result?.data?.text || '').slice(0, MAX_TEXT);
}

/**
 * Extraction de texte multi-formats pour scan IA / aperçu / excerpt.
 * Formats : PDF, Word (.doc/.docx), Excel, PowerPoint, OpenDocument,
 * Markdown, HTML, CSV, RTF, images (OCR Tesseract local fra+eng).
 * Aucune clé API externe requise.
 *
 * @param {boolean} [opts.fast] saute OCR (upload HTTP) ; le scan async fait le travail complet
 */
export async function extractDocumentText(
  absPath,
  { mimeType = '', fileName = '', fast = false } = {}
) {
  const mime = (mimeType || '').toLowerCase();
  const ext = extensionOf(fileName, absPath);

  try {
    if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) {
      if (fast) return '';
      return await extractImageOcr(absPath);
    }

    // PDF via pdf-parse (évite pdfjs-dist vulnérable d'officeparser).
    if (ext === 'pdf' || mime === 'application/pdf') {
      try {
        return await extractPdf(absPath);
      } catch (pdfErr) {
        console.warn('[text-extract] pdf-parse:', pdfErr.message);
        return '';
      }
    }

    if (ext === 'doc' || mime === 'application/msword') {
      if (ext === 'doc' || !mime.includes('openxml')) {
        try {
          return await extractLegacyDoc(absPath);
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
      try {
        return await extractWithOfficeParser(absPath, { withOcr: false });
      } catch (err) {
        console.warn('[text-extract] officeparser:', err.message);
      }
    }

    if (
      TEXT_EXTS.has(ext) ||
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml'
    ) {
      return await extractPlainText(absPath);
    }

    try {
      const text = await extractPlainText(absPath);
      if (text && /[\p{L}\p{N}]/u.test(text.slice(0, 500))) {
        return text;
      }
    } catch {
      /* ignore */
    }

    return '';
  } catch (err) {
    console.warn('[text-extract]', err.message);
    return '';
  }
}

export const SUPPORTED_EXTRACT_HINT =
  'Formats lus : PDF, Word (.doc/.docx), Excel, PowerPoint, OpenDocument, Markdown, HTML, CSV, RTF, images (OCR).';

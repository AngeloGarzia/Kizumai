import { access } from 'fs/promises';
import { readFile } from 'fs/promises';
import path from 'path';
import officeParser from 'officeparser';
import Tesseract from 'tesseract.js';
import WordExtractor from 'word-extractor';
import { assertSafeZipBuffer } from '../utils/archiveGuard.js';
import { assertImageWithinOcrLimits, isZipBasedOfficeExt } from '../utils/imageLimits.js';
import { withProcessingTimeout } from '../utils/withProcessingTimeout.js';
import { withTempFile } from '../utils/tempFile.js';
import {
  DOCUMENT_LIMITS,
  DocumentProcessingError,
} from './documentProcessingLimits.js';

/** Dossier tessdata (Docker : /app/tessdata ; local : ./tessdata si présent). */
const TESSDATA_DIR =
  process.env.TESSDATA_PATH || path.join(process.cwd(), 'tessdata');

let tessdataReady = null;

async function resolveOcrOptions() {
  if (tessdataReady == null) {
    tessdataReady = access(path.join(TESSDATA_DIR, 'eng.traineddata'))
      .then(() => true)
      .catch(() => false);
  }
  const local = await tessdataReady;
  return local
    ? { langPath: TESSDATA_DIR, logger: () => {} }
    : { logger: () => {} };
}

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

/** Texte trop court = probablement PDF scanné / couche texte absente. */
const MIN_MEANINGFUL_CHARS = 40;

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

function meaningfulLength(text) {
  return String(text || '').replace(/\s+/g, '').length;
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

async function loadPdfParser() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const mod = require('pdf-parse');
  // v2 : { PDFParse } — v1 : fonction default (rétrocompat).
  if (mod?.PDFParse) return { kind: 'v2', PDFParse: mod.PDFParse };
  const fn = typeof mod === 'function' ? mod : mod?.default;
  if (typeof fn === 'function') return { kind: 'v1', parse: fn };
  throw new DocumentProcessingError(
    'Module pdf-parse incompatible (API inconnue)',
    'pdf_module_unsupported'
  );
}

async function ocrImageBuffer(imgBuffer, limits, label = 'page.png') {
  if (!imgBuffer?.length) return '';
  return withTempFile(Buffer.from(imgBuffer), label, async (imgPath) => {
    assertImageWithinOcrLimits(await readFile(imgPath), limits);
    const result = await Tesseract.recognize(imgPath, 'fra+eng', await resolveOcrOptions());
    return String(result?.data?.text || '').trim();
  });
}

/**
 * PDF via pdf-parse v2 (PDFParse) + OCR des pages si peu/pas de texte.
 */
async function extractPdf(absPath, limits) {
  const buffer = await readFile(absPath);
  if (buffer.length > limits.pdfMaxBytes) {
    throw new DocumentProcessingError(
      'PDF trop volumineux pour l\'extraction',
      'pdf_too_large'
    );
  }

  const api = await loadPdfParser();

  if (api.kind === 'v1') {
    const parsed = await api.parse(buffer, { max: limits.pdfMaxPages });
    if (parsed.numpages > limits.pdfMaxPages) {
      throw new DocumentProcessingError(
        `PDF : trop de pages (${parsed.numpages} > ${limits.pdfMaxPages})`,
        'pdf_too_many_pages'
      );
    }
    return String(parsed?.text || '').slice(0, limits.maxTextChars);
  }

  const parser = new api.PDFParse({ data: buffer });
  try {
    let totalPages = null;
    try {
      const info = await parser.getInfo();
      totalPages = Number(info?.total) || Number(info?.totalPages) || null;
    } catch {
      totalPages = null;
    }

    if (totalPages != null && totalPages > limits.pdfMaxPages) {
      throw new DocumentProcessingError(
        `PDF : trop de pages (${totalPages} > ${limits.pdfMaxPages})`,
        'pdf_too_many_pages'
      );
    }

    const textOpts =
      totalPages != null && totalPages > limits.pdfMaxPages
        ? { first: limits.pdfMaxPages }
        : {};
    const result = await parser.getText(textOpts);
    let text = String(result?.text || '').trim();

    if (meaningfulLength(text) < MIN_MEANINGFUL_CHARS) {
      const ocrCap = Math.min(
        Number(limits.pdfOcrMaxPages) || 12,
        Number(limits.pdfMaxPages) || 80,
        totalPages || Number(limits.pdfOcrMaxPages) || 12
      );
      const shots = await parser.getScreenshot({
        first: ocrCap,
        scale: 1.6,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const parts = [];
      for (const page of shots?.pages || []) {
        const img = page?.data || page?.buffer;
        if (!img?.length) continue;
        const pageNo = page.pageNumber || page.num || parts.length + 1;
        try {
          const pageText = await ocrImageBuffer(img, limits, `pdf-p${pageNo}.png`);
          if (pageText) parts.push(pageText);
        } catch (err) {
          console.warn(`[text-extract] OCR page ${pageNo}:`, err.message);
        }
      }
      if (parts.length) {
        text = parts.join('\n\n');
      }
    }

    return text.slice(0, limits.maxTextChars);
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }
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
  const result = await Tesseract.recognize(absPath, 'fra+eng', await resolveOcrOptions());
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

    // Dernier recours : tenter Office puis texte brut.
    try {
      const officeText = await extractWithOfficeParser(absPath, ext, limits);
      if (meaningfulLength(officeText) >= MIN_MEANINGFUL_CHARS) {
        return officeText;
      }
    } catch {
      /* ignore */
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
  'Formats lus : PDF (texte + OCR si scanné), Word (.doc/.docx), Excel, PowerPoint, OpenDocument, Markdown, HTML, CSV, RTF, images (OCR).';

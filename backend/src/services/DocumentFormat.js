import path from 'path';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import { AppError } from '../utils/AppError.js';

/**
 * Whitelist stricte des uploads (magic bytes + extension).
 * Interdits : HTML, SVG, JS, XML, exécutables, etc.
 */
export const ALLOWED_EXT_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Extensions texte sans magic fiable (contenu inspecté). */
const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'rtf']);

const ZIP_OFFICE_BY_EXT = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

const DANGEROUS_MIME = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/ecmascript',
  'text/ecmascript',
  'application/xml',
  'text/xml',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-httpd-php',
  'text/x-python',
  'application/wasm',
]);

const DANGEROUS_EXT = new Set([
  'html',
  'htm',
  'xhtml',
  'svg',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'php',
  'phtml',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'exe',
  'dll',
  'bat',
  'cmd',
  'ps1',
  'sh',
  'bash',
  'wasm',
  'xml',
  'svgz',
]);

/** MIME sûrs pour éventuel affichage inline (jamais HTML/SVG). */
const INLINE_SAFE_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export function extensionOf(fileName = '') {
  return path.extname(fileName || '').replace(/^\./, '').toLowerCase();
}

export function isDangerousMime(mime = '') {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (!m) return false;
  if (DANGEROUS_MIME.has(m)) return true;
  if (m.includes('html') || m.includes('javascript') || m.includes('ecmascript')) return true;
  if (m === 'image/svg+xml') return true;
  return false;
}

export function isAllowedUploadMime(mime = '') {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  return Object.values(ALLOWED_EXT_MIME).includes(m);
}

function looksLikeHtmlOrScript(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  const head = buffer.subarray(0, Math.min(512, buffer.length)).toString('utf8').toLowerCase();
  const trimmed = head.replace(/^\uFEFF/, '').trimStart();
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return true;
  if (/<\s*script[\s>]/i.test(trimmed)) return true;
  if (/<\s*svg[\s>]/i.test(trimmed)) return true;
  if (trimmed.startsWith('<?xml') && /svg/i.test(trimmed.slice(0, 200))) return true;
  return false;
}

function bufferLooksLikeZipOffice(buffer, ext) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  // Signature ZIP locale
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;

  // Heuristique anti-ZIP arbitraire : présence des marqueurs OOXML/ODF attendus.
  const hay = buffer.subarray(0, Math.min(buffer.length, 2 * 1024 * 1024)).toString('binary');
  const requiredByExt = {
    docx: ['[Content_Types].xml', 'word/'],
    xlsx: ['[Content_Types].xml', 'xl/'],
    pptx: ['[Content_Types].xml', 'ppt/'],
    odt: ['mimetype', 'content.xml'],
    ods: ['mimetype', 'content.xml'],
    odp: ['mimetype', 'content.xml'],
  };
  const needed = requiredByExt[ext];
  if (!needed) return false;
  return needed.every((marker) => hay.includes(marker));
}

function fromDetected(detected, extFromName, buffer = null) {
  if (!detected?.mime) return null;
  let mime = detected.mime;
  const magicExt = detected.ext || null;

  if (
    (mime === 'application/zip' || mime === 'application/x-zip-compressed') &&
    ZIP_OFFICE_BY_EXT[extFromName]
  ) {
    if (buffer && !bufferLooksLikeZipOffice(buffer, extFromName)) {
      throw new AppError('Archive Office invalide ou non reconnue', 400);
    }
    mime = ZIP_OFFICE_BY_EXT[extFromName];
    return {
      mimeType: mime,
      ext: extFromName || magicExt,
      source: 'magic',
    };
  }

  return {
    mimeType: mime,
    ext: magicExt || extFromName || null,
    source: 'magic',
  };
}

/**
 * Détecte le format réel.
 * Priorité : magic bytes → extension whitelist (texte) → rejet (jamais MIME client).
 */
export async function resolveUploadedFileFormat({
  absPath,
  buffer = null,
  originalName = '',
  clientMime = '',
} = {}) {
  const extFromName = extensionOf(originalName);
  void clientMime; // jamais de confiance

  if (DANGEROUS_EXT.has(extFromName)) {
    throw new AppError('Type de fichier non autorisé', 400);
  }

  let detected = null;
  try {
    if (buffer && Buffer.isBuffer(buffer)) {
      detected = await fileTypeFromBuffer(buffer);
    } else if (absPath) {
      detected = await fileTypeFromFile(absPath);
    }
  } catch (err) {
    console.warn('[file-format] file-type:', err.message);
  }

  const fromMagic = fromDetected(detected, extFromName, buffer);
  if (fromMagic) {
    return fromMagic;
  }

  // Texte / formats sans signature : extension whitelist + anti-polyglotte HTML/SVG
  if (TEXT_EXTS.has(extFromName) && ALLOWED_EXT_MIME[extFromName]) {
    if (buffer && looksLikeHtmlOrScript(buffer)) {
      throw new AppError('Contenu HTML/script/SVG refusé', 400);
    }
    return {
      mimeType: ALLOWED_EXT_MIME[extFromName],
      ext: extFromName,
      source: 'extension',
    };
  }

  throw new AppError(
    'Format de fichier non reconnu ou non autorisé (magic bytes / extension)',
    400
  );
}

/**
 * Valide que le format résolu est dans la whitelist et cohérent.
 */
export function assertAllowedUploadFormat(format, { originalName = '', buffer = null } = {}) {
  if (!format?.mimeType) {
    throw new AppError('Format de fichier indétectable', 400);
  }

  const mime = String(format.mimeType).toLowerCase().split(';')[0].trim();
  const ext = extensionOf(originalName) || format.ext || '';

  if (isDangerousMime(mime) || DANGEROUS_EXT.has(ext)) {
    throw new AppError('Type de fichier non autorisé', 400);
  }

  if (!isAllowedUploadMime(mime)) {
    throw new AppError(`Type MIME non autorisé : ${mime}`, 400);
  }

  const expected = ALLOWED_EXT_MIME[ext];
  if (ext && expected && expected !== mime) {
    // Exception ZIP→OOXML déjà normalisée ; sinon rejet polyglotte extension/MIME
    const zipOk =
      format.source === 'magic' &&
      ZIP_OFFICE_BY_EXT[ext] === mime;
    if (!zipOk) {
      throw new AppError('Extension et type réel incohérents', 400);
    }
  }

  if (buffer && looksLikeHtmlOrScript(buffer) && !mime.startsWith('image/')) {
    // Images binaires peuvent contenir des chaînes HTML dans EXIF — on ignore pour raster
    if (mime.startsWith('text/') || mime === 'application/rtf' || mime === 'text/markdown') {
      throw new AppError('Contenu HTML/script/SVG refusé', 400);
    }
  }

  return { mimeType: mime, ext: format.ext || ext || null, source: format.source };
}

/** MIME effectif pour la réponse download (jamais HTML/SVG/JS). */
export function safeDownloadMime(storedMime) {
  const mime = String(storedMime || '').toLowerCase().split(';')[0].trim();
  if (!mime || isDangerousMime(mime) || !isAllowedUploadMime(mime)) {
    return 'application/octet-stream';
  }
  return mime;
}

export function shouldInlineDownload(mime) {
  return INLINE_SAFE_MIME.has(String(mime || '').toLowerCase().split(';')[0].trim());
}

/** Content-Disposition RFC 5987, attachment par défaut. */
export function buildContentDisposition(fileName, { inline = false } = {}) {
  const raw = String(fileName || 'document').replace(/[\r\n"]/g, '_').slice(0, 180);
  const ascii = raw.replace(/[^\x20-\x7E]/g, '_') || 'document';
  const encoded = encodeURIComponent(raw);
  const kind = inline ? 'inline' : 'attachment';
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Accept HTML pour inputs fichier frontend. */
export const FRONTEND_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.md,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif';

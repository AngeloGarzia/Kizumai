import { AppError } from './AppError.js';
import { DOCUMENT_LIMITS, DocumentProcessingError } from '../services/documentProcessingLimits.js';

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

function isUnsafeZipEntryName(name) {
  const n = String(name || '').replace(/\\/g, '/');
  if (!n || n.startsWith('/') || n.includes('../') || n.includes('/../')) return true;
  if (/^[a-zA-Z]:/.test(n)) return true;
  return false;
}

/**
 * Inspecte une archive ZIP (DOCX/XLSX/…) sans la décompresser entièrement.
 * Refuse zip bombs, trop d'entrées et path traversal.
 */
export function assertSafeZipBuffer(buffer, limits = DOCUMENT_LIMITS) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new DocumentProcessingError('Archive ZIP invalide ou trop petite', 'invalid_zip');
  }

  let eocdOffset = -1;
  const searchStart = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= searchStart; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new DocumentProcessingError('Archive ZIP : fin de central directory introuvable', 'invalid_zip');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  if (entryCount > limits.zipMaxEntries) {
    throw new DocumentProcessingError(
      `Archive ZIP : trop d'entrées (${entryCount} > ${limits.zipMaxEntries})`,
      'zip_too_many_entries'
    );
  }

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (cdOffset >= buffer.length) {
    throw new DocumentProcessingError('Archive ZIP : central directory invalide', 'invalid_zip');
  }

  let offset = cdOffset;
  let totalUncompressed = 0;

  for (let e = 0; e < entryCount; e += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CD_SIG) {
      throw new DocumentProcessingError('Archive ZIP : entrée central directory corrompue', 'invalid_zip');
    }

    const compSize = buffer.readUInt32LE(offset + 20);
    const uncompSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);

    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buffer.length) {
      throw new DocumentProcessingError('Archive ZIP : nom de fichier tronqué', 'invalid_zip');
    }

    const name = buffer.subarray(nameStart, nameEnd).toString('utf8');
    if (isUnsafeZipEntryName(name)) {
      throw new DocumentProcessingError('Archive ZIP : chemin d\'entrée non autorisé', 'zip_path_traversal');
    }

    if (uncompSize > limits.zipMaxEntryUncompressedBytes) {
      throw new DocumentProcessingError('Archive ZIP : entrée trop volumineuse', 'zip_entry_too_large');
    }

    totalUncompressed += uncompSize;
    if (totalUncompressed > limits.zipMaxUncompressedBytes) {
      throw new DocumentProcessingError('Archive ZIP : taille décompressée excessive', 'zip_bomb');
    }

    if (compSize > 0 && uncompSize / compSize > limits.zipMaxCompressionRatio) {
      throw new DocumentProcessingError('Archive ZIP : ratio de compression suspect', 'zip_bomb');
    }

    offset = nameEnd + extraLen + commentLen;
  }
}

/** Alias pour tests upload security. */
export function assertSafeZipArchive(buffer, limits) {
  try {
    assertSafeZipBuffer(buffer, limits);
  } catch (err) {
    if (err instanceof DocumentProcessingError) {
      throw new AppError(err.message, 400);
    }
    throw err;
  }
}

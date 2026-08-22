import {
  DOCUMENT_LIMITS,
  DocumentProcessingError,
} from '../services/documentProcessingLimits.js';

const ZIP_OFFICE_EXTS = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub']);

export function isZipBasedOfficeExt(ext) {
  return ZIP_OFFICE_EXTS.has(String(ext || '').toLowerCase());
}

/** Lit dimensions JPEG (SOF0) ou PNG (IHDR). */
export function readImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // JPEG — scan markers
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buffer[i + 1];
      const len = buffer.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
      i += 2 + len;
    }
  }

  return null;
}

/** GIF/WebP : dimensions non fiables sans décodeur complet — refus OCR par défaut. */
const GIF_SIG = Buffer.from('GIF8');
const RIFF = Buffer.from('RIFF');
const WEBP = Buffer.from('WEBP');

function isGifBuffer(buffer) {
  return buffer.length >= 6 && buffer.subarray(0, 3).equals(GIF_SIG);
}

function isWebpBuffer(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(RIFF) &&
    buffer.subarray(8, 12).equals(WEBP)
  );
}

export function assertImageWithinOcrLimits(buffer, limits = DOCUMENT_LIMITS) {
  if (buffer.length > limits.ocrMaxBytes) {
    throw new DocumentProcessingError(
      `Image trop volumineuse pour OCR (${buffer.length} octets)`,
      'ocr_image_too_large'
    );
  }
  if (isGifBuffer(buffer) || isWebpBuffer(buffer)) {
    throw new DocumentProcessingError(
      'Format image non pris en charge pour OCR (GIF/WebP)',
      'ocr_format_unsupported'
    );
  }
  const dim = readImageDimensions(buffer);
  if (!dim) {
    throw new DocumentProcessingError(
      'Dimensions image indétectables — OCR refusé',
      'ocr_dimensions_unknown'
    );
  }
  if (dim.width * dim.height > limits.ocrMaxPixels) {
    throw new DocumentProcessingError(
      `Image trop grande pour OCR (${dim.width}×${dim.height} px)`,
      'ocr_image_too_large'
    );
  }
}

export { DOCUMENT_LIMITS };

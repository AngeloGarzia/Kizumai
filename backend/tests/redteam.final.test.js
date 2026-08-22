/**
 * Tests post-audit Red Team — régressions des corrections finales.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
  assertAllowedUploadFormat,
  resolveUploadedFileFormat,
} = await import('../src/services/DocumentFormat.js');
const { UpdateDocumentRequestDto } = await import('../src/dto/document.dto.js');
const { assertImageWithinOcrLimits } = await import('../src/utils/imageLimits.js');
const { DocumentProcessingError } = await import('../src/services/documentProcessingLimits.js');
const { validateProductionEnvironment } = await import('../src/config/envValidation.js');
const { enqueueDocumentExtract, initDocumentJobProcessor } = await import(
  '../src/queue/documentQueue.js'
);
const { AppError } = await import('../src/utils/AppError.js');

function buildMinimalZip(entries) {
  const localParts = [];
  let offset = 0;
  const centralParts = [];
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(entry.compSize ?? 0, 14);
    localHeader.writeUInt32LE(entry.uncompSize ?? 0, 18);
    localHeader.writeUInt16LE(nameBuf.length, 22);
    nameBuf.copy(localHeader, 30);
    localParts.push(localHeader);
    offset += localHeader.length;
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(entry.compSize ?? 0, 20);
    cd.writeUInt32LE(entry.uncompSize ?? 0, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset - localHeader.length, 42);
    nameBuf.copy(cd, 46);
    centralParts.push(cd);
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(Buffer.concat(localParts).length, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

describe('post-audit — upload ZIP bomb à l’ingestion', () => {
  it('refuse docx zip bomb avant stockage', () => {
    const zip = buildMinimalZip([{ name: 'word/document.xml', compSize: 5, uncompSize: 50_000 }]);
    const format = {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: 'docx',
      source: 'magic',
    };
    assert.throws(
      () => assertAllowedUploadFormat(format, { originalName: 'bomb.docx', buffer: zip }),
      (e) => e instanceof AppError
    );
  });
});

describe('post-audit — mass assignment excerpt', () => {
  it('UpdateDocumentRequestDto ignore excerpt client', () => {
    const dto = UpdateDocumentRequestDto.from({
      excerpt: '<script>alert(1)</script>',
      title: 'ok',
    });
    assert.equal(dto.excerpt, undefined);
    assert.equal(dto.title, 'ok');
  });

  it('limite title trop long', () => {
    assert.throws(
      () => UpdateDocumentRequestDto.from({ title: 'x'.repeat(300) }),
      /title/i
    );
  });
});

describe('post-audit — OCR GIF/WebP fail-closed', () => {
  it('refuse GIF pour OCR', () => {
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
    assert.throws(
      () => assertImageWithinOcrLimits(gif),
      (e) => e instanceof DocumentProcessingError && e.code === 'ocr_format_unsupported'
    );
  });
});

describe('post-audit — dedupe extract queue', () => {
  it('n’enqueue qu’une fois le même documentId', async () => {
    let calls = 0;
    initDocumentJobProcessor(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
    });
    await enqueueDocumentExtract({ documentId: 42 });
    await enqueueDocumentExtract({ documentId: 42 });
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(calls, 1);
  });
});

describe('post-audit — REDIS_URL prod obligatoire', () => {
  it('validateProductionEnvironment exige REDIS_URL', () => {
    assert.throws(
      () =>
        validateProductionEnvironment({
          NODE_ENV: 'production',
          CORS_ORIGIN: 'https://app.example.com',
          APP_URL: 'https://app.example.com',
          DATABASE_URL: 'postgresql://kizumai_app:Str0ngUniqueDbPass99!@db.internal:5432/kizumai',
          JWT_ACCESS_SECRET: 'a'.repeat(40),
          JWT_REFRESH_SECRET: 'b'.repeat(40),
        }),
      /REDIS_URL/i
    );
  });
});

describe('post-audit — HTML offset dans texte', () => {
  it('refuse HTML après padding dans .txt', async () => {
    const pad = Buffer.alloc(600, 0x20);
    const tail = Buffer.from('<html><script>alert(1)</script></html>');
    const buf = Buffer.concat([pad, tail]);
    await assert.rejects(
      () => resolveUploadedFileFormat({ buffer: buf, originalName: 'note.txt' }),
      /HTML|script|SVG|refusé/i
    );
  });
});

describe('post-audit — rate limit exports', () => {
  it('expose limiters upload/admin/auth redis', async () => {
    const rl = await import('../src/middleware/rateLimiter.js');
    assert.equal(typeof rl.uploadRateLimiter, 'function');
    assert.equal(typeof rl.adminRateLimiter, 'function');
    assert.equal(typeof rl.loginRedisQuota, 'function');
    assert.equal(typeof rl.uploadRedisQuota, 'function');
  });
});

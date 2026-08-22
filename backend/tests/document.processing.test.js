/**
 * Tests DoS / limites traitement document (extract, ZIP, OCR, timeout).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.QUEUE_ENABLED = 'false';
delete process.env.REDIS_URL;

const { assertSafeZipBuffer } = await import('../src/utils/archiveGuard.js');
const { assertImageWithinOcrLimits, readImageDimensions } = await import(
  '../src/utils/imageLimits.js'
);
const { withProcessingTimeout } = await import('../src/utils/withProcessingTimeout.js');
const { DocumentProcessingError, DOCUMENT_LIMITS } = await import(
  '../src/services/documentProcessingLimits.js'
);
const { initDocumentJobProcessor } = await import('../src/queue/documentQueue.js');

function buildMinimalZip(entries) {
  const localParts = [];
  let offset = 0;
  const centralParts = [];

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(entry.compSize ?? 0, 14);
    localHeader.writeUInt32LE(entry.uncompSize ?? 0, 18);
    localHeader.writeUInt16LE(nameBuf.length, 22);
    localHeader.writeUInt16LE(0, 24);
    localHeader.writeUInt16LE(0, 26);
    nameBuf.copy(localHeader, 30);

    localParts.push(localHeader);
    offset += localHeader.length;

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(entry.compSize ?? 0, 20);
    cd.writeUInt32LE(entry.uncompSize ?? 0, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset - localHeader.length, 42);
    nameBuf.copy(cd, 46);
    centralParts.push(cd);
  }

  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(Buffer.concat(localParts).length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

function buildPng(width, height) {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(8, 0);
  buf.write('IHDR', 4);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

describe('archiveGuard — ZIP bomb / traversal', () => {
  const limits = {
    ...DOCUMENT_LIMITS,
    zipMaxEntries: 3,
    zipMaxUncompressedBytes: 1024,
    zipMaxCompressionRatio: 50,
    zipMaxEntryUncompressedBytes: 800,
  };

  it('accepte une archive DOCX-like normale', () => {
    const zip = buildMinimalZip([
      { name: 'word/document.xml', compSize: 100, uncompSize: 200 },
      { name: '[Content_Types].xml', compSize: 50, uncompSize: 80 },
    ]);
    assert.doesNotThrow(() => assertSafeZipBuffer(zip, limits));
  });

  it('refuse path traversal', () => {
    const zip = buildMinimalZip([
      { name: '../etc/passwd', compSize: 1, uncompSize: 1 },
    ]);
    assert.throws(
      () => assertSafeZipBuffer(zip, limits),
      (err) => err instanceof DocumentProcessingError && err.code === 'zip_path_traversal'
    );
  });

  it('refuse trop d\'entrées', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      name: `part${i}.xml`,
      compSize: 1,
      uncompSize: 1,
    }));
    assert.throws(
      () => assertSafeZipBuffer(buildMinimalZip(entries), limits),
      /trop d'entrées/i
    );
  });

  it('refuse ratio de compression suspect (zip bomb)', () => {
    const zip = buildMinimalZip([
      { name: 'bomb.xml', compSize: 5, uncompSize: 400 },
    ]);
    assert.throws(
      () => assertSafeZipBuffer(zip, limits),
      (err) => err instanceof DocumentProcessingError && err.code === 'zip_bomb'
    );
  });

  it('refuse taille décompressée cumulée excessive', () => {
    const zip = buildMinimalZip([
      { name: 'a.xml', compSize: 100, uncompSize: 600 },
      { name: 'b.xml', compSize: 100, uncompSize: 600 },
    ]);
    assert.throws(
      () => assertSafeZipBuffer(zip, limits),
      (err) =>
        err instanceof DocumentProcessingError &&
        (err.code === 'zip_bomb' || /décompressée excessive/i.test(err.message))
    );
  });
});

describe('imageLimits — OCR', () => {
  const limits = {
    ...DOCUMENT_LIMITS,
    ocrMaxPixels: 1000,
    ocrMaxBytes: 500,
  };

  it('lit les dimensions PNG', () => {
    const dim = readImageDimensions(buildPng(800, 600));
    assert.deepEqual(dim, { width: 800, height: 600 });
  });

  it('refuse image géante (pixels)', () => {
    const png = buildPng(2000, 2000);
    assert.throws(
      () => assertImageWithinOcrLimits(png, limits),
      (err) => err instanceof DocumentProcessingError
    );
  });

  it('refuse image trop volumineuse (octets)', () => {
    const big = Buffer.alloc(600, 0xff);
    big[0] = 0xff;
    big[1] = 0xd8;
    assert.throws(
      () => assertImageWithinOcrLimits(big, limits),
      /trop volumineuse/i
    );
  });

  it('refuse GIF pour OCR', () => {
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]);
    assert.throws(
      () => assertImageWithinOcrLimits(gif, limits),
      /GIF\/WebP/i
    );
  });
});

describe('withProcessingTimeout', () => {
  it('résout si la promesse termine à temps', async () => {
    const out = await withProcessingTimeout(Promise.resolve('ok'), 500, 'test');
    assert.equal(out, 'ok');
  });

  it('rejette proprement si délai dépassé', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
    await assert.rejects(
      () => withProcessingTimeout(slow, 30, 'extract'),
      (err) => err instanceof DocumentProcessingError && err.code === 'timeout'
    );
  });
});

describe('documentQueue locale — concurrence limitée', () => {
  it('traite plusieurs jobs sans dépasser la concurrence configurée', async () => {
    let running = 0;
    let maxRunning = 0;
    const done = [];

    initDocumentJobProcessor(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 40));
      running -= 1;
      done.push(1);
    });

    const { enqueueDocumentExtract } = await import('../src/queue/documentQueue.js');
    await Promise.all([
      enqueueDocumentExtract({ documentId: 1 }),
      enqueueDocumentExtract({ documentId: 2 }),
      enqueueDocumentExtract({ documentId: 3 }),
    ]);

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(done.length, 3);
    assert.ok(maxRunning <= DOCUMENT_LIMITS.workerConcurrency);
  });
});

describe('DocumentTextExtractor — PDF taille', () => {
  it('refuse PDF trop volumineux avant parsing', async () => {
    const { extractDocumentText } = await import('../src/services/DocumentTextExtractor.js');
    const { mkdtemp, writeFile, rm } = await import('fs/promises');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const dir = await mkdtemp(join(tmpdir(), 'kizumai-pdf-'));
    const file = join(dir, 'big.pdf');
    const header = Buffer.from('%PDF-1.4\n');
    const body = Buffer.alloc(2 * 1024 * 1024, 0x41);
    await writeFile(file, Buffer.concat([header, body]));

    try {
      await assert.rejects(
        () =>
          extractDocumentText(file, {
            mimeType: 'application/pdf',
            fileName: 'big.pdf',
            limits: { ...DOCUMENT_LIMITS, pdfMaxBytes: 1024 * 1024 },
          }),
        (err) => err instanceof DocumentProcessingError && err.code === 'pdf_too_large'
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

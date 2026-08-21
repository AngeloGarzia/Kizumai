/**
 * Tests XSS / upload / download hardening.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.QUEUE_ENABLED = 'false';
delete process.env.REDIS_URL;
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars!';

const {
  resolveUploadedFileFormat,
  assertAllowedUploadFormat,
  safeDownloadMime,
  shouldInlineDownload,
  buildContentDisposition,
  isDangerousMime,
} = await import('../src/services/DocumentFormat.js');
const { StorageService, uploadRoot } = await import('../src/services/StorageService.js');
const { resolve, sep } = await import('path');

describe('dangerous MIME / XSS file types', () => {
  it('flags HTML SVG JS', () => {
    assert.equal(isDangerousMime('text/html'), true);
    assert.equal(isDangerousMime('image/svg+xml'), true);
    assert.equal(isDangerousMime('application/javascript'), true);
    assert.equal(isDangerousMime('application/pdf'), false);
  });

  it('rejects HTML upload by extension', async () => {
    const html = Buffer.from('<script>alert(1)</script>');
    await assert.rejects(
      () =>
        resolveUploadedFileFormat({
          buffer: html,
          originalName: 'xss.html',
          clientMime: 'text/plain',
        }),
      /non autorisé/i
    );
  });

  it('rejects SVG upload even with image MIME client claim', async () => {
    const svg = Buffer.from('<svg onload="alert(1)"></svg>');
    await assert.rejects(
      () =>
        resolveUploadedFileFormat({
          buffer: svg,
          originalName: 'x.svg',
          clientMime: 'image/png',
        }),
      /non autorisé/i
    );
  });

  it('rejects HTML polyglot disguised as .txt', async () => {
    const html = Buffer.from('<!DOCTYPE html><html><img src=x onerror=alert(1)></html>');
    await assert.rejects(
      () =>
        resolveUploadedFileFormat({
          buffer: html,
          originalName: 'note.txt',
          clientMime: 'text/plain',
        }),
      /HTML|script|SVG|autorisé/i
    );
  });

  it('rejects client MIME alone (no magic, unknown ext)', async () => {
    await assert.rejects(
      () =>
        resolveUploadedFileFormat({
          buffer: Buffer.from('not a real file'),
          originalName: 'payload.exe',
          clientMime: 'application/pdf',
        }),
      /non autorisé|non reconnu/i
    );
  });

  it('accepts PNG magic bytes', async () => {
    // Minimal PNG header
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const format = await resolveUploadedFileFormat({
      buffer: png,
      originalName: 'photo.png',
    });
    const allowed = assertAllowedUploadFormat(format, {
      originalName: 'photo.png',
      buffer: png,
    });
    assert.equal(allowed.mimeType, 'image/png');
  });

  it('accepts plain text notes', async () => {
    const buf = Buffer.from('Bonjour Kizumai\nligne 2');
    const format = await resolveUploadedFileFormat({
      buffer: buf,
      originalName: 'note.txt',
    });
    assert.equal(format.mimeType, 'text/plain');
  });
});

describe('download headers helpers', () => {
  it('never serves HTML as HTML', () => {
    assert.equal(safeDownloadMime('text/html'), 'application/octet-stream');
    assert.equal(safeDownloadMime('image/svg+xml'), 'application/octet-stream');
    assert.equal(safeDownloadMime('application/pdf'), 'application/pdf');
  });

  it('inline only for pdf and safe rasters', () => {
    assert.equal(shouldInlineDownload('application/pdf'), true);
    assert.equal(shouldInlineDownload('image/png'), true);
    assert.equal(shouldInlineDownload('text/plain'), false);
    assert.equal(shouldInlineDownload('text/html'), false);
  });

  it('Content-Disposition defaults to attachment without CR/LF', () => {
    const h = buildContentDisposition('rapport "x".pdf\r\n', { inline: false });
    assert.match(h, /^attachment;/);
    assert.doesNotMatch(h, /\r|\n/);
    assert.match(h, /filename\*=UTF-8''/);
  });

  it('inline disposition when requested for safe type', () => {
    const h = buildContentDisposition('a.pdf', { inline: true });
    assert.match(h, /^inline;/);
  });
});

describe('storage path traversal', () => {
  it('rejects .. in storage key', () => {
    assert.throws(() => StorageService.absolutePath('../etc/passwd'), /invalide/);
    assert.throws(() => StorageService.absolutePath('12/../../etc/passwd'), /invalide/);
  });

  it('resolves under upload root', () => {
    const abs = StorageService.absolutePath('12/abc.pdf');
    const root = uploadRoot.endsWith(sep) ? uploadRoot : uploadRoot + sep;
    assert.ok(abs.startsWith(root) || abs === uploadRoot);
    assert.equal(abs, resolve(uploadRoot, '12/abc.pdf'));
  });
});

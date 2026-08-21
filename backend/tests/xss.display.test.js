/**
 * Affichage React / anti XSS (texte IA).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendSrc = join(__dirname, '../../frontend/src');

const { sanitizeDisplayText, DOCUMENT_ACCEPT } = await import(
  '../../frontend/src/utils/safeDisplay.js'
);

describe('frontend XSS surface', () => {
  it('does not use dangerouslySetInnerHTML in key views', () => {
    const files = [
      'components/ProjectReport.jsx',
      'pages/Resources.jsx',
      'pages/FilDuTemps.jsx',
      'pages/ProjectSearch.jsx',
      'components/DocumentScanModal.jsx',
    ];
    for (const f of files) {
      const content = readFileSync(join(frontendSrc, f), 'utf8');
      assert.doesNotMatch(content, /dangerouslySetInnerHTML/);
      assert.doesNotMatch(content, /\.innerHTML\s*=/);
    }
  });

  it('sanitizeDisplayText strips controls and nulls', () => {
    const dirty = `Hello\u0000<script>alert(1)</script>\u0007`;
    const clean = sanitizeDisplayText(dirty);
    assert.equal(clean.includes('\u0000'), false);
    assert.equal(clean.includes('\u0007'), false);
    assert.match(clean, /script/);
  });

  it('DOCUMENT_ACCEPT excludes html and svg', () => {
    assert.doesNotMatch(DOCUMENT_ACCEPT, /html|htm|svg|image\/\*/i);
  });
});

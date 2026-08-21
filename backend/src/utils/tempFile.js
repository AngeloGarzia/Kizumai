import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Écrit un buffer dans un fichier temporaire pour les extracteurs
 * qui n'acceptent qu'un chemin (officeparser, tesseract, word-extractor…).
 */
export async function withTempFile(buffer, fileName, fn) {
  const safe = String(fileName || 'file.bin')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120) || 'file.bin';
  const dir = await mkdtemp(join(tmpdir(), 'kizumai-doc-'));
  const abs = join(dir, safe);
  try {
    await writeFile(abs, buffer);
    return await fn(abs);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

import { createReadStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '../..');

export const uploadRoot = resolve(backendRoot, config.storage.localDir);

export const StorageService = {
  async ensureProjectDir(projectId) {
    const dir = join(uploadRoot, String(projectId));
    await mkdir(dir, { recursive: true });
    return dir;
  },

  absolutePath(storageKey) {
    const key = String(storageKey || '').replace(/^[/\\]+/, '');
    if (!key || key.includes('..')) {
      throw new Error('Chemin de stockage invalide');
    }
    const abs = resolve(uploadRoot, key);
    const rootWithSep = uploadRoot.endsWith(sep) ? uploadRoot : uploadRoot + sep;
    if (abs !== uploadRoot && !abs.startsWith(rootWithSep)) {
      throw new Error('Chemin de stockage invalide');
    }
    return abs;
  },

  createReadStream(storageKey) {
    return createReadStream(this.absolutePath(storageKey));
  },

  async remove(storageKey) {
    try {
      await unlink(this.absolutePath(storageKey));
    } catch {
      // ignore
    }
  },
};

import { createReadStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Racine du backend (src/services -> ../..).
const backendRoot = resolve(__dirname, '../..');

// Répertoire de stockage local (dev). En prod, on pourra brancher un driver
// objet (ex. OVH Object Storage S3) derrière la même interface.
export const uploadRoot = resolve(backendRoot, config.storage.localDir);

export const StorageService = {
  async ensureProjectDir(projectId) {
    const dir = join(uploadRoot, String(projectId));
    await mkdir(dir, { recursive: true });
    return dir;
  },

  // storageKey est relatif à uploadRoot (ex. "12/uuid-fichier.pdf").
  absolutePath(storageKey) {
    const abs = resolve(uploadRoot, storageKey);
    // Garde-fou anti path traversal : rester sous uploadRoot.
    if (!abs.startsWith(uploadRoot)) {
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
      // Fichier déjà absent : on ignore.
    }
  },
};

import { randomUUID } from 'crypto';
import multer from 'multer';
import { config } from '../config/index.js';
import { StorageService, uploadRoot } from '../services/StorageService.js';

function safeName(original) {
  const base = (original || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  return `${randomUUID()}-${base}`;
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = await StorageService.ensureProjectDir(req.params.id);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, safeName(file.originalname));
  },
});

// Aucun filtre de type : tout format de document est autorisé.
export const uploadDocument = multer({
  storage,
  limits: { fileSize: config.storage.maxFileSizeBytes },
}).single('file');

// Calcule la clé relative à partir du chemin absolu écrit par multer.
export function toStorageKey(absolutePath) {
  return absolutePath.replace(`${uploadRoot}`, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
}

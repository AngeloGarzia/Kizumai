import { randomUUID } from 'crypto';
import multer from 'multer';
import path from 'path';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { ALLOWED_EXT_MIME, extensionOf } from '../services/DocumentFormat.js';

function safeName(original) {
  const ext = extensionOf(original);
  const allowedExt = ext && ALLOWED_EXT_MIME[ext] ? `.${ext}` : '';
  // Nom de stockage aléatoire — ne pas réutiliser le nom client.
  return `${randomUUID()}${allowedExt}`;
}

/** Clé logique hors webroot (relative au storage local). */
export function makeStorageKey(projectId, originalName) {
  const pid = Number(projectId);
  if (!Number.isInteger(pid) || pid < 1) {
    throw new AppError('projectId invalide pour stockage', 400);
  }
  return `${pid}/${safeName(originalName)}`;
}

function fileFilter(_req, file, cb) {
  const ext = extensionOf(file.originalname);
  if (!ext || !ALLOWED_EXT_MIME[ext]) {
    cb(new AppError('Extension de fichier non autorisée', 400));
    return;
  }
  cb(null, true);
}

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.storage.maxFileSizeBytes,
    files: 1,
  },
  fileFilter,
}).single('file');

/** @deprecated Conservé pour compat scripts legacy. */
export function toStorageKey(absolutePath) {
  return String(absolutePath || '')
    .replace(/^[\\/]/, '')
    .replace(/\\/g, '/');
}

export { path };

import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { errorResponse } from '../utils/response.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, next) => {
  // Les erreurs d'upload (multer) sont des erreurs client (413/400).
  const statusCode =
    err.statusCode || (err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : 500);

  let message = err.message || 'Erreur interne du serveur';
  if (statusCode === 500 && config.isProd) {
    message = 'Erreur interne du serveur';
  }

  if (config.isDev) {
    console.error(err);
  }

  errorResponse(res, message, statusCode);
};

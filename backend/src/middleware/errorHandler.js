import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { errorResponse } from '../utils/response.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode ||
    (err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : 500);

  const isOperational = err instanceof AppError || Boolean(err.statusCode);
  let message = err.message || 'Erreur interne du serveur';

  if (statusCode >= 500 && config.isProd) {
    message = 'Erreur interne du serveur';
  }

  if (config.isDev) {
    console.error(err);
  } else if (statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'unhandled_error',
        statusCode,
        name: err.name,
        code: err.code,
        path: req.originalUrl,
        method: req.method,
        operational: isOperational,
        // Pas de stack complète ni de body utilisateur en prod.
        errorMessage: String(err.message || '').slice(0, 300),
      })
    );
  }

  errorResponse(res, message, statusCode);
};

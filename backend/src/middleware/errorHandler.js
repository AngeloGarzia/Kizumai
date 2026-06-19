import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { errorResponse } from '../utils/response.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  let message = err.message || 'Erreur interne du serveur';
  if (statusCode === 500 && config.isProd) {
    message = 'Erreur interne du serveur';
  }

  if (config.isDev) {
    console.error(err);
  }

  errorResponse(res, message, statusCode);
};

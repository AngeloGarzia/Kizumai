import { hasPaidAccess } from '../constants/plans.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/AppError.js';

export const requirePaid = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Non authentifié', 401);
  }
  if (!hasPaidAccess(req.user)) {
    throw new AppError('Un compte payant est requis pour accéder à cette fonctionnalité', 403);
  }
  next();
});

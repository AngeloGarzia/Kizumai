import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/AppError.js';
import { isAdmin } from '../constants/roles.js';

export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!isAdmin(req.user)) {
    throw new AppError('Accès administrateur requis', 403);
  }
  next();
});

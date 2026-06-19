import { UserService } from '../services/UserService.js';
import { asyncHandler } from '../utils/AppError.js';
import { AppError } from '../utils/AppError.js';
import { isAdmin } from '../constants/roles.js';
import { successResponse } from '../utils/response.js';

export const UserController = {
  getAll: asyncHandler(async (req, res) => {
    const users = await UserService.getAllUsers();
    successResponse(res, users);
  }),

  getById: asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (req.user.id !== targetId && !isAdmin(req.user)) {
      throw new AppError('Accès refusé', 403);
    }
    const user = await UserService.getUserById(targetId);
    successResponse(res, user);
  }),

  update: asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (req.user.id !== targetId && !isAdmin(req.user)) {
      throw new AppError('Accès refusé', 403);
    }
    const user = await UserService.updateUser(targetId, req.body);
    successResponse(res, user);
  }),

  delete: asyncHandler(async (req, res) => {
    if (!isAdmin(req.user)) {
      throw new AppError('Accès refusé', 403);
    }
    await UserService.deleteUser(req.params.id);
    successResponse(res, { message: 'Utilisateur supprimé' });
  }),
};
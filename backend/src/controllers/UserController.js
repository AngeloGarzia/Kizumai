import {
  UpdateUserRequestDto,
  UserIdParamDto,
  UserResponseDto,
} from '../dto/user.dto.js';
import { asyncHandler, AppError } from '../utils/AppError.js';
import { isAdmin } from '../constants/roles.js';
import { successResponse } from '../utils/response.js';

export function createUserController({ userService }) {
  return {
    getAll: asyncHandler(async (req, res) => {
      const users = await userService.getAllUsers();
      successResponse(res, UserResponseDto.fromMany(users));
    }),

    getById: asyncHandler(async (req, res) => {
      const { id } = UserIdParamDto.from(req.params);
      if (req.user.id !== id && !isAdmin(req.user)) {
        throw new AppError('Accès refusé', 403);
      }
      const user = await userService.getUserById(id);
      successResponse(res, UserResponseDto.from(user));
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = UserIdParamDto.from(req.params);
      if (req.user.id !== id && !isAdmin(req.user)) {
        throw new AppError('Accès refusé', 403);
      }
      const dto = UpdateUserRequestDto.from(req.body);
      const user = await userService.updateUser(id, dto);
      successResponse(res, UserResponseDto.from(user));
    }),

    delete: asyncHandler(async (req, res) => {
      if (!isAdmin(req.user)) {
        throw new AppError('Accès refusé', 403);
      }
      const { id } = UserIdParamDto.from(req.params);
      await userService.deleteUser(id);
      successResponse(res, { message: 'Utilisateur supprimé' });
    }),
  };
}

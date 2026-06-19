import { UserModel } from '../models/UserModel.js';
import { AppError } from '../utils/AppError.js';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitize.js';

export const UserService = {
  async getAllUsers() {
    const users = await UserModel.findAll();
    return sanitizeUsers(users);
  },

  async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }
    return sanitizeUser(user);
  },

  async updateUser(id, data) {
    const forbidden = ['password', 'refreshTokenVersion', 'id', 'email'];
    const safeData = Object.fromEntries(
      Object.entries(data).filter(([key]) => !forbidden.includes(key))
    );

    const user = await UserModel.update(id, safeData);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }
    return sanitizeUser(user);
  },

  async deleteUser(id) {
    const deleted = await UserModel.delete(id);
    if (!deleted) {
      throw new AppError('Utilisateur introuvable', 404);
    }
  },
};

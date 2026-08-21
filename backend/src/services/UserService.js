import { AppError } from '../utils/AppError.js';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitize.js';

export function createUserService({ userRepository }) {
  return {
    async getAllUsers() {
      const users = await userRepository.findAll();
      return sanitizeUsers(users);
    },

    async getUserById(id) {
      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('Utilisateur introuvable', 404);
      }
      return sanitizeUser(user);
    },

    async updateUser(id, data) {
      const forbidden = [
        'password',
        'refreshTokenVersion',
        'id',
        'email',
        'role',
        'plan',
      ];
      const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => !forbidden.includes(key))
      );

      const user = await userRepository.update(id, safeData);
      if (!user) {
        throw new AppError('Utilisateur introuvable', 404);
      }
      return sanitizeUser(user);
    },

    async deleteUser(id) {
      const deleted = await userRepository.delete(id);
      if (!deleted) {
        throw new AppError('Utilisateur introuvable', 404);
      }
    },
  };
}

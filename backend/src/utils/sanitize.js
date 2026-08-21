import { UserResponseDto } from '../dto/user.dto.js';

/** @deprecated Préférer UserResponseDto.from */
export const sanitizeUser = (user) => UserResponseDto.from(user);

/** @deprecated Préférer UserResponseDto.fromMany */
export const sanitizeUsers = (users) => UserResponseDto.fromMany(users);

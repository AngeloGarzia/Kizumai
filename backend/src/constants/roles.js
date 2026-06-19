export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

export const isUser = (user) => user?.role === ROLES.USER;

/** L'administrateur hérite des droits utilisateur */
export const hasUserAccess = (user) => isUser(user) || isAdmin(user);

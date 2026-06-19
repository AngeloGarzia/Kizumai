const SENSITIVE_FIELDS = ['password', 'refreshTokenVersion'];

export const sanitizeUser = (user) => {
  if (!user) return null;

  const publicUser = { ...user };
  for (const field of SENSITIVE_FIELDS) {
    delete publicUser[field];
  }
  return publicUser;
};

export const sanitizeUsers = (users) => users.map(sanitizeUser);

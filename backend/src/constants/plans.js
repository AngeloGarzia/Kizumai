export const PLANS = {
  FREE: 'free',
  PAID: 'paid',
};

/** Nombre max de projets indépendants par compte utilisateur (règle métier). */
export const MAX_PROJECTS_PER_USER = 3;

export function hasPaidAccess(user) {
  if (!user) return false;
  return user.role === 'admin' || user.plan === PLANS.PAID;
}

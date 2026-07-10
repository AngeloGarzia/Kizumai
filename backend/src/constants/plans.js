export const PLANS = {
  FREE: 'free',
  PAID: 'paid',
};

export function hasPaidAccess(user) {
  if (!user) return false;
  return user.role === 'admin' || user.plan === PLANS.PAID;
}

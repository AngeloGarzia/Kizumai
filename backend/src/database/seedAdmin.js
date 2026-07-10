import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { UserModel } from '../models/UserModel.js';
import { PLANS } from '../constants/plans.js';
import { ROLES } from '../constants/roles.js';

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@myrokai.com';
  const existing = await UserModel.findByEmail(email);

  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      await UserModel.updateRole(existing.id, ROLES.ADMIN);
      console.log(`[seed] Rôle administrateur attribué à ${email}`);
    }
    if (existing.plan !== PLANS.PAID) {
      await UserModel.updatePlan(existing.id, PLANS.PAID);
    }
    return;
  }

  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);

  await UserModel.create({
    name: 'Administrateur',
    email,
    password: hashedPassword,
    role: ROLES.ADMIN,
    plan: PLANS.PAID,
  });

  console.log(`[seed] Compte administrateur créé : ${email}`);
}

import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { UserModel } from '../models/UserModel.js';
import { PLANS } from '../constants/plans.js';
import { ROLES } from '../constants/roles.js';

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@kizumai.com';
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

  if (config.isProd && !process.env.ADMIN_PASSWORD) {
    throw new Error(
      "[seed] ADMIN_PASSWORD est requis en production pour créer le compte administrateur"
    );
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

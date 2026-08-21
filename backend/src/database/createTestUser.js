import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { PLANS } from '../constants/plans.js';
import { ROLES } from '../constants/roles.js';
import pool from './pool.js';

/**
 * Crée (ou met à niveau) un utilisateur de test disposant de toutes les
 * fonctionnalités : rôle administrateur + plan payant.
 *
 * Personnalisable via variables d'environnement :
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_NAME
 */
async function createTestUser() {
  const email = (process.env.TEST_USER_EMAIL || 'test@kizumai.fr').toLowerCase();
  const password = process.env.TEST_USER_PASSWORD || 'Test1234!';
  const name = process.env.TEST_USER_NAME || 'Utilisateur Test';

  const existing = await UserRepository.findByEmail(email);

  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      await UserRepository.updateRole(existing.id, ROLES.ADMIN);
    }
    if (existing.plan !== PLANS.PAID) {
      await UserRepository.updatePlan(existing.id, PLANS.PAID);
    }
    console.log(`[test-user] Compte existant mis à niveau : ${email}`);
    console.log(`[test-user] Mot de passe inchangé (utiliser celui déjà défini).`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);

  await UserRepository.create({
    name,
    email,
    password: hashedPassword,
    role: ROLES.ADMIN,
    plan: PLANS.PAID,
  });

  console.log('[test-user] Compte de test créé avec succès :');
  console.log(`  Email       : ${email}`);
  console.log(`  Mot de passe: ${password}`);
  console.log(`  Rôle        : ${ROLES.ADMIN}`);
  console.log(`  Plan        : ${PLANS.PAID}`);
}

createTestUser()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[test-user] Échec :', error);
    return pool.end().finally(() => process.exit(1));
  });



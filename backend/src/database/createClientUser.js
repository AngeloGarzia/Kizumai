import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { LocationRepository } from '../repositories/LocationRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { PLANS } from '../constants/plans.js';
import { ROLES } from '../constants/roles.js';
import pool from './pool.js';

/**
 * Crée un utilisateur « client » type : une personne (rôle user, plan payant)
 * en train de créer son entreprise, avec un projet complet (activité + lieu).
 *
 * Personnalisable via variables d'environnement :
 *   CLIENT_EMAIL, CLIENT_PASSWORD, CLIENT_NAME
 */
async function createClientUser() {
  const email = (process.env.CLIENT_EMAIL || 'client@kizumai.fr').toLowerCase();
  const password = process.env.CLIENT_PASSWORD || 'Client1234!';
  const name = process.env.CLIENT_NAME || 'Camille Durand';

  let user = await UserRepository.findByEmail(email);

  if (user) {
    // Le plan payant est requis pour accéder aux fonctionnalités projet.
    if (user.plan !== PLANS.PAID) {
      await UserRepository.updatePlan(user.id, PLANS.PAID);
    }
    console.log(`[client] Compte client existant réutilisé : ${email}`);
  } else {
    const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
    user = await UserRepository.create({
      name,
      email,
      password: hashedPassword,
      role: ROLES.USER,
      plan: PLANS.PAID,
    });
    console.log(`[client] Compte client créé : ${email}`);
  }

  // Activité : boulangerie artisanale.
  const activity = await ActivityRepository.findOrCreate({
    label: 'Boulangerie artisanale',
    sector: 'Commerce de détail alimentaire',
    subSector: 'Boulangerie-pâtisserie',
    apeCode: '10.71C',
    description:
      "Fabrication et vente de pains, viennoiseries et pâtisseries artisanales à partir de farines locales.",
  });

  // Lieu : local commercial à Lyon.
  const location = await LocationRepository.findOrCreate({
    label: 'Local commercial - Lyon 3e',
    addressLine1: '24 rue de la Part-Dieu',
    postalCode: '69003',
    city: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    department: 'Rhône',
    country: 'FR',
    latitude: 45.760_5,
    longitude: 4.855_9,
  });

  // Projet de création d'entreprise.
  const project = await ProjectRepository.create({
    userId: user.id,
    title: 'Ouverture de ma boulangerie artisanale',
    activityId: activity.id,
    locationId: location.id,
    budget: 85_000,
    currency: 'EUR',
    legalForm: 'SASU',
    status: 'active',
    stage: 'business_plan',
    description:
      "Création d'une boulangerie artisanale de quartier proposant des pains au levain, viennoiseries et une offre snacking le midi. Objectif d'ouverture dans 8 mois.",
    source: 'manual',
    sections: [
      { key: 'marche', title: 'Étude de marché', done: true },
      { key: 'financement', title: 'Plan de financement', done: false },
      { key: 'local', title: 'Recherche de local', done: true },
    ],
  });

  console.log('[client] Projet de création d\'entreprise créé :');
  console.log(`  Utilisateur : ${name} <${email}>`);
  console.log(`  Mot de passe: ${user.plan && password ? password : '(inchangé)'}`);
  console.log(`  Projet #${project.id} : ${project.title}`);
  console.log(`  Activité    : ${activity.label} (APE ${activity.apeCode})`);
  console.log(`  Lieu        : ${location.label}, ${location.city}`);
  console.log(`  Étape       : ${project.stage} · Statut : ${project.status}`);
}

createClientUser()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[client] Échec :', error);
    return pool.end().finally(() => process.exit(1));
  });



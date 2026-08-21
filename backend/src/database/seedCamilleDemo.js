/**
 * Seed démo riche pour Camille Durand — comme si la recherche avait démarré il y a 3 mois.
 *
 * Usage :
 *   node --env-file=.env.development src/database/seedCamilleDemo.js
 *
 * Compte : client@kizumai.fr / Client1234!
 */
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { PLANS } from '../constants/plans.js';
import { ROLES } from '../constants/roles.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { LocationRepository } from '../repositories/LocationRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { DocumentRepository } from '../repositories/DocumentRepository.js';
import { ContactRepository } from '../repositories/ContactRepository.js';
import { ContactLinkRepository } from '../repositories/ContactLinkRepository.js';
import { PlannerEventRepository } from '../repositories/PlannerEventRepository.js';
import { LearningRecordRepository } from '../repositories/LearningRecordRepository.js';
import { ProjectStageRepository } from '../repositories/ProjectStageRepository.js';
import pool from './pool.js';

const EMAIL = (process.env.CLIENT_EMAIL || 'client@kizumai.fr').toLowerCase();
const PASSWORD = process.env.CLIENT_PASSWORD || 'Client1234!';
const NAME = process.env.CLIENT_NAME || 'Camille Durand';

function daysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function iso(d) {
  return d.toISOString();
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

async function backdate(table, id, createdAt, updatedAt = createdAt) {
  await pool.query(
    `UPDATE ${table} SET created_at = $2, updated_at = $3 WHERE id = $1`,
    [id, createdAt, updatedAt]
  );
}

async function writeFakeFile(projectId, fileName, content) {
  const storageKey = `${projectId}/${randomUUID()}-${fileName}`;
  const buf = Buffer.from(content, 'utf8');
  return { storageKey, sizeBytes: buf.length, content: buf };
}

async function purgeUserData(userId) {
  // Ordre prudent : events / learning / contacts / projects (cascade docs + stages)
  await pool.query('DELETE FROM planner_events WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM learning_records WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM contacts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM projects WHERE user_id = $1', [userId]);
}

async function seedCamilleDemo() {
  console.log('[seed-camille] Démarrage…');

  let user = await UserRepository.findByEmail(EMAIL);
  if (user) {
    if (user.plan !== PLANS.PAID) await UserRepository.updatePlan(user.id, PLANS.PAID);
    if (user.name !== NAME) {
      await pool.query('UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1', [
        user.id,
        NAME,
      ]);
      user = await UserRepository.findById(user.id);
    }
    console.log(`[seed-camille] Compte existant : ${EMAIL}`);
  } else {
    const hashedPassword = await bcrypt.hash(PASSWORD, config.bcrypt.saltRounds);
    user = await UserRepository.create({
      name: NAME,
      email: EMAIL,
      password: hashedPassword,
      role: ROLES.USER,
      plan: PLANS.PAID,
    });
    console.log(`[seed-camille] Compte créé : ${EMAIL}`);
  }

  await purgeUserData(user.id);

  const started = daysAgo(90);
  const searchDone = daysAgo(75);
  const marketStart = daysAgo(70);
  const interviews = daysAgo(55);
  const competition = daysAgo(40);
  const synthesis = daysAgo(20);

  const activity = await ActivityRepository.findOrCreate({
    label: 'Boulangerie artisanale',
    sector: 'Commerce de détail alimentaire',
    subSector: 'Boulangerie-pâtisserie',
    apeCode: '10.71C',
    description:
      'Fabrication et vente de pains au levain, viennoiseries et snacking de midi à partir de farines locales.',
  });

  const location = await LocationRepository.findOrCreate({
    label: 'Local commercial - Lyon 3e Part-Dieu',
    addressLine1: '24 rue de la Part-Dieu',
    postalCode: '69003',
    city: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    department: 'Rhône',
    country: 'FR',
    latitude: 45.7605,
    longitude: 4.8559,
  });

  const report = [
    '## Contexte',
    'Camille Durand souhaite ouvrir une boulangerie artisanale de quartier à Lyon 3e, orientée levain et circuits courts.',
    '',
    '## Marché local',
    '• Densité de population élevée autour de la Part-Dieu',
    '• Forte demande de pains de qualité et d’options snacking le midi',
    '• Concurrence présente mais peu d’offre 100 % artisanale au levain',
    '',
    '## Offre proposée',
    'Pains au levain, viennoiseries maison, sandwiches du midi, boissons locales.',
    '',
    '## Budget',
    'Investissement initial estimé à 85 000 € (local, matériel, stock, trésorerie de démarrage).',
    '',
    '## Risques',
    'Loyer, recrutement d’un second boulanger, saisonnalité touristique limitée.',
  ].join('\n');

  const sections = [
    {
      title: 'Synthèse exécutive',
      content:
        'Projet de boulangerie artisanale à Lyon 3e. Positionnement premium accessible, différenciation par le levain et les farines locales.',
    },
    {
      title: 'Clients cibles',
      content:
        '• Actifs du quartier Part-Dieu (déjeuner)\n• Familles du 3e (pains du week-end)\n• Habitants sensibles au bio / local',
    },
    {
      title: 'Concurrence',
      content:
        '• Paul (réseau) — volume\n• Boulangerie du Coin — tradition\n• Bio c’ Bon — snacking\n• Food-trucks midi — prix bas',
    },
    {
      title: 'Budget prévisionnel',
      content:
        'Matériel fournil 35 k€ · Aménagement 20 k€ · Stock 8 k€ · Trésorerie 15 k€ · Divers 7 k€.',
    },
  ];

  const project = await ProjectRepository.create({
    userId: user.id,
    title: 'Boulangerie Levain — Lyon Part-Dieu',
    activityId: activity.id,
    locationId: location.id,
    budget: 85_000,
    currency: 'EUR',
    legalForm: 'SASU',
    status: 'active',
    stage: 'etude_marche',
    description:
      "Création d'une boulangerie artisanale de quartier proposant pains au levain, viennoiseries et snacking le midi. Recherche démarrée il y a 3 mois.",
    report,
    sections,
    source: 'ai',
  });

  await pool.query(
    `UPDATE projects
     SET created_at = $2, updated_at = $3, ai_prompt = $4
     WHERE id = $1`,
    [
      project.id,
      iso(started),
      iso(daysAgo(2)),
      'Prompt recherche projet boulangerie Lyon — seed démo Camille',
    ]
  );

  // ── Documents fictifs ──────────────────────────────────────────
  const docsSpec = [
    {
      title: 'Compte-rendu interviews clients',
      fileName: 'interviews-clients-avril.txt',
      type: 'document',
      categorySlug: 'etude_interviews',
      days: 55,
      body: 'Compte-rendu fictif — 5 interviews clients Part-Dieu (avril).\nBesoins : pain frais le soir, sandwichs midi, option sans gluten limitée.',
    },
    {
      title: 'Tableau concurrentiel',
      fileName: 'concurrence-lyon3.csv',
      type: 'spreadsheet',
      categorySlug: 'etude_concurrence',
      days: 40,
      body: 'nom;type;prix_baguette;force\nPaul;reseau;1.30;notoriete\nBoulangerie du Coin;artisan;1.40;qualite\nBio c Bon;bio;1.60;sante\n',
    },
    {
      title: 'Devis fournil',
      fileName: 'devis-fournil-dummy.pdf',
      type: 'pdf',
      categorySlug: 'finance',
      days: 35,
      body: '%PDF-1.4\n% Faux devis fournil — seed démo Kizumai\nDevis n°2026-0412 — Fournil Bongard — 34 800 EUR HT\n',
    },
    {
      title: 'Photos local candidat',
      fileName: 'local-part-dieu-notes.txt',
      type: 'image',
      categorySlug: 'local',
      days: 60,
      body: 'Notes visite local 24 rue de la Part-Dieu — vitrine 6m, réserve arrière, loyer 2 450 € HC.',
    },
    {
      title: 'Synthèse SWOT brouillon',
      fileName: 'swot-brouillon.txt',
      type: 'document',
      categorySlug: 'etude_synthese',
      days: 18,
      body: 'Forces : savoir-faire, emplacement.\nFaiblesses : premier local, cash.\nOpportunités : midi bureaux.\nMenaces : loyers, chaînes.',
    },
  ];

  const categoryBySlug = {};
  const catRows = await pool.query('SELECT id, slug FROM resource_categories');
  for (const row of catRows.rows) categoryBySlug[row.slug] = row.id;

  const documents = [];
  for (const spec of docsSpec) {
    const { storageKey, sizeBytes, content } = await writeFakeFile(
      project.id,
      spec.fileName,
      spec.body
    );
    const doc = await DocumentRepository.create({
      projectId: project.id,
      uploadedBy: user.id,
      type: spec.type,
      title: spec.title,
      fileName: spec.fileName,
      storageKey,
      mimeType: spec.type === 'pdf' ? 'application/pdf' : 'text/plain',
      sizeBytes,
      categoryId: categoryBySlug[spec.categorySlug] || null,
      description: `Document seed — ${spec.title}`,
      excerpt: spec.body.slice(0, 500),
      attributes: { stage: 'etude_marche', seed: true },
      content,
    });
    await backdate('documents', doc.id, iso(daysAgo(spec.days)));
    documents.push(doc);
  }

  // ── Contacts fictifs ───────────────────────────────────────────
  const contactsSpec = [
    {
      displayName: 'Sophie Martin',
      firstName: 'Sophie',
      lastName: 'Martin',
      category: 'client',
      email: 'sophie.martin@email-demo.fr',
      phone: '06 12 34 56 01',
      jobTitle: 'Salariée Part-Dieu',
      notes: 'Interviewée le 22 avril — achète du pain tous les soirs.',
      days: 55,
      role: 'interviewé',
    },
    {
      displayName: 'Karim Benali',
      firstName: 'Karim',
      lastName: 'Benali',
      category: 'client',
      email: 'karim.benali@email-demo.fr',
      phone: '06 12 34 56 02',
      jobTitle: 'Développeur',
      notes: 'Cherche sandwichs midi sans file d’attente.',
      days: 54,
      role: 'interviewé',
    },
    {
      displayName: 'Élodie Petit',
      firstName: 'Élodie',
      lastName: 'Petit',
      category: 'partenaire',
      organization: 'Meunerie des Monts',
      email: 'e.petit@meunerie-demo.fr',
      phone: '04 72 00 00 11',
      jobTitle: 'Commerciale',
      notes: 'Fournisseur farines bio locales — devis reçu.',
      days: 45,
      role: 'fournisseur',
    },
    {
      displayName: 'Marc Lefèvre',
      firstName: 'Marc',
      lastName: 'Lefèvre',
      category: 'expert_comptable',
      organization: 'Cabinet Lefèvre & Associés',
      email: 'marc.lefevre@cabinet-demo.fr',
      phone: '04 78 00 00 22',
      jobTitle: 'Expert-comptable',
      notes: 'Accompagnement création SASU — RDV prévu.',
      days: 30,
      role: 'conseil',
    },
    {
      displayName: 'Nadia Rossi',
      firstName: 'Nadia',
      lastName: 'Rossi',
      category: 'banquier',
      organization: 'Banque Populaire Lyon',
      email: 'nadia.rossi@banque-demo.fr',
      phone: '04 72 00 00 33',
      jobTitle: 'Conseillère pro',
      notes: 'Échange prêt d’honneur / PGE création.',
      days: 25,
      role: 'finance',
    },
    {
      displayName: 'Jean Dupont',
      firstName: 'Jean',
      lastName: 'Dupont',
      category: 'autre',
      organization: 'Boulangerie du Coin',
      email: 'contact@boulangerie-coin-demo.fr',
      phone: '04 78 00 00 44',
      jobTitle: 'Gérant concurrent',
      notes: 'Concurrent direct — observation vitrine (pas d’interview).',
      days: 42,
      role: 'concurrent',
    },
  ];

  const contacts = [];
  for (const spec of contactsSpec) {
    const contact = await ContactRepository.create({
      userId: user.id,
      projectId: project.id,
      contactType: 'person',
      category: spec.category,
      firstName: spec.firstName,
      lastName: spec.lastName,
      displayName: spec.displayName,
      jobTitle: spec.jobTitle,
      organization: spec.organization || null,
      email: spec.email,
      phone: spec.phone,
      notes: spec.notes,
      source: 'market_study',
      tags: ['etude_marche', 'seed'],
    });
    await backdate('contacts', contact.id, iso(daysAgo(spec.days)));
    contacts.push({ ...contact, role: spec.role });
  }

  // ── Stage étude de marché ──────────────────────────────────────
  const run = await ProjectStageRepository.createRun({
    projectId: project.id,
    stage: 'etude_marche',
    status: 'in_progress',
  });
  await pool.query(
    `UPDATE project_stage_runs
     SET started_at = $2, progress_percent = 45, created_at = $2, updated_at = $3
     WHERE id = $1`,
    [run.id, iso(marketStart), iso(daysAgo(1))]
  );

  const actions = await ProjectStageRepository.listActiveActionsForStage('etude_marche');
  await ProjectStageRepository.seedTasks(
    run.id,
    actions.map((a) => a.id)
  );

  const tasks = await ProjectStageRepository.listTasks(run.id);
  const doneSlugs = new Set([
    'definir-objectifs',
    'definir-zone',
    'definir-segment',
    'creer-personas',
    'interviews',
    'synthese-besoins',
    'estimer-taille',
    'lister-concurrents',
    'comparer-offres',
  ]);
  const inProgressSlugs = new Set(['forces-faiblesses', 'reglementation']);

  for (const task of tasks) {
    const slug = task.action?.slug;
    if (doneSlugs.has(slug)) {
      await ProjectStageRepository.updateTask(task.id, {
        status: 'done',
        completedAt: iso(daysAgo(slug === 'interviews' ? 50 : 35)),
        completedBy: user.id,
        notes:
          slug === 'interviews'
            ? '5 interviews réalisées (Sophie, Karim + 3 autres).'
            : 'Validé lors de la phase terrain.',
      });
    } else if (inProgressSlugs.has(slug)) {
      await ProjectStageRepository.updateTask(task.id, {
        status: 'in_progress',
        notes: 'En cours — à finaliser cette semaine.',
      });
    }
  }

  const milestoneTemplates = await ProjectStageRepository.listMilestoneTemplates('etude_marche');
  await ProjectStageRepository.seedMilestones(
    run.id,
    milestoneTemplates.map((t) => {
      const at = new Date(marketStart);
      at.setDate(at.getDate() + (t.offsetDays || 0));
      return {
        slug: t.slug,
        title: t.title,
        description: t.description,
        milestoneAt: at.toISOString(),
        sortOrder: t.sortOrder,
      };
    })
  );

  const milestones = await ProjectStageRepository.listMilestones(run.id);
  for (const m of milestones) {
    if (['kickoff', 'fin-terrain', 'revue-concurrence'].includes(m.slug)) {
      await ProjectStageRepository.updateMilestone(m.id, { status: 'done' });
    }
  }

  // Liens stage → documents & contacts
  for (const doc of documents) {
    await ProjectStageRepository.createLink({
      stageRunId: run.id,
      entityType: 'document',
      entityId: doc.id,
      role: 'preuve',
    });
  }

  // Contacts ↔ documents (pour la page Ressources)
  const docByTitle = Object.fromEntries(documents.map((d) => [d.title, d]));
  const contactByName = Object.fromEntries(contacts.map((c) => [c.displayName, c]));
  const docContactPairs = [
    ['Compte-rendu interviews clients', 'Sophie Martin', 'interviewé'],
    ['Compte-rendu interviews clients', 'Karim Benali', 'interviewé'],
    ['Devis fournil', 'Élodie Petit', 'fournisseur'],
    ['Photos local candidat', 'Marc Lefèvre', 'conseil'],
    ['Synthèse SWOT brouillon', 'Nadia Rossi', 'relecture'],
  ];
  for (const [docTitle, contactName, role] of docContactPairs) {
    const doc = docByTitle[docTitle];
    const contact = contactByName[contactName];
    if (doc && contact) {
      await ContactLinkRepository.link({
        contactId: contact.id,
        entityType: 'document',
        entityId: doc.id,
        role,
      });
    }
  }

  for (const contact of contacts) {
    await ProjectStageRepository.createLink({
      stageRunId: run.id,
      entityType: 'contact',
      entityId: contact.id,
      role: contact.role,
    });
    await ContactLinkRepository.link({
      contactId: contact.id,
      entityType: 'project',
      entityId: project.id,
      role: contact.role,
    });
    await ContactLinkRepository.link({
      contactId: contact.id,
      entityType: 'project_stage_run',
      entityId: run.id,
      role: contact.role,
    });
  }

  // Recalc progress
  const refreshedTasks = await ProjectStageRepository.listTasks(run.id);
  const required = refreshedTasks.filter((t) => t.action?.isRequired !== false);
  const done = required.filter((t) => t.status === 'done').length;
  const progress = required.length ? Math.round((done / required.length) * 100) : 0;
  await ProjectStageRepository.updateRun(run.id, {
    status: 'in_progress',
    progressPercent: progress,
    startedAt: iso(marketStart),
  });

  // ── Planner ────────────────────────────────────────────────────
  const events = [
    {
      kind: 'appointment',
      title: 'Interview Sophie Martin',
      startAt: iso(daysAgo(55, 12)),
      endAt: iso(daysAgo(55, 13)),
      status: 'done',
      location: 'Café Part-Dieu',
    },
    {
      kind: 'appointment',
      title: 'Visite local rue de la Part-Dieu',
      startAt: iso(daysAgo(60, 15)),
      endAt: iso(daysAgo(60, 16)),
      status: 'done',
      location: '24 rue de la Part-Dieu',
    },
    {
      kind: 'deadline',
      title: 'Rendre synthèse SWOT',
      startAt: iso(daysAgo(5, 9)),
      endAt: iso(daysAgo(5, 18)),
      status: 'todo',
      allDay: true,
    },
    {
      kind: 'appointment',
      title: 'RDV expert-comptable Marc Lefèvre',
      startAt: iso(daysAgo(-3, 10)),
      endAt: iso(daysAgo(-3, 11)),
      status: 'todo',
      location: 'Cabinet Lefèvre',
    },
    {
      kind: 'task',
      title: 'Finaliser cartographie concurrence',
      startAt: iso(daysAgo(2, 9)),
      endAt: iso(daysAgo(2, 12)),
      status: 'in_progress',
    },
  ];

  for (const ev of events) {
    const created = await PlannerEventRepository.create({
      userId: user.id,
      projectId: project.id,
      kind: ev.kind,
      title: ev.title,
      description: 'Événement seed démo Camille — étude de marché',
      startAt: ev.startAt,
      endAt: ev.endAt,
      allDay: Boolean(ev.allDay),
      status: ev.status,
      location: ev.location || null,
      color: '#e8722a',
      metadata: { seed: true, stage: 'etude_marche' },
    });
    await backdate('planner_events', created.id, ev.startAt);
    await ProjectStageRepository.createLink({
      stageRunId: run.id,
      entityType: 'planner_event',
      entityId: created.id,
      role: 'échéance_cle',
    });
  }

  // ── Learning records ───────────────────────────────────────────
  const formation = await LearningRecordRepository.create({
    userId: user.id,
    projectId: project.id,
    recordType: 'formation',
    title: 'CAP Boulanger — validation des acquis',
    organization: 'CFA Lyon restauration',
    status: 'termine',
    level: 'CAP',
    field: 'Boulangerie',
    format: 'presentiel',
    startDate: dateOnly(daysAgo(400)),
    endDate: dateOnly(daysAgo(100)),
    durationLabel: '2 ans',
    diplomaObtained: true,
    skills: ['levain', 'viennoiserie', 'gestion de fournil'],
    description: 'Diplôme obtenu avant le lancement du projet.',
    source: 'manual',
  });
  await backdate('learning_records', formation.id, iso(daysAgo(100)));

  const stageFormation = await LearningRecordRepository.create({
    userId: user.id,
    projectId: project.id,
    recordType: 'formation',
    title: 'Gestion d’une TPE alimentaire',
    organization: 'CCI Lyon Métropole',
    status: 'en_cours',
    level: 'Court',
    field: 'Gestion',
    format: 'mixte',
    startDate: dateOnly(daysAgo(30)),
    endDate: dateOnly(daysAgo(-30)),
    durationLabel: '6 semaines',
    skills: ['comptabilité', 'stocks', 'RH'],
    description: 'Formation suivie en parallèle de l’étude de marché.',
    source: 'manual',
  });
  await backdate('learning_records', stageFormation.id, iso(daysAgo(30)));

  console.log('');
  console.log('[seed-camille] ✅ Données de test prêtes');
  console.log(`  Utilisateur : ${NAME} <${EMAIL}>`);
  console.log(`  Mot de passe: ${PASSWORD}`);
  console.log(`  Projet #${project.id} : ${project.title}`);
  console.log(`  Démarré     : ${dateOnly(started)} (il y a ~3 mois)`);
  console.log(`  Étape       : etude_marche (~${progress} %)`);
  console.log(`  Documents   : ${documents.length}`);
  console.log(`  Contacts    : ${contacts.length}`);
  console.log(`  Workflows   : ${done}/${required.length} actions requises terminées`);
  console.log(`  Planner     : ${events.length} événements`);
  console.log(`  Formations  : 2`);
}

seedCamilleDemo()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[seed-camille] Échec :', error);
    await pool.end().catch(() => {});
    process.exit(1);
  });

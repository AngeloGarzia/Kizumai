import { PROJECT_STAGE_LABELS, PROJECT_STAGES } from '../constants/projectStages.js';

function matchProjectStage(pathname) {
  const m = pathname.match(/^\/projet\/(\d+)\/etape\/([a-z_]+)/);
  if (!m) return null;
  const stageId = m[2];
  return {
    projectId: Number(m[1]),
    stageId,
    stageLabel: PROJECT_STAGE_LABELS[stageId] || stageId,
  };
}

function matchProjectDetail(pathname) {
  const m = pathname.match(/^\/projet\/(\d+)\/?$/);
  if (!m) return null;
  return { projectId: Number(m[1]) };
}

/**
 * Déduit page, rubrique et détail à partir de la route courante.
 */
export function buildPageGuideContext(location) {
  const pathname = location?.pathname || '/';
  const search = location?.search || '';
  const hash = location?.hash || '';

  const stageMatch = matchProjectStage(pathname);
  if (stageMatch) {
    const short = PROJECT_STAGES.find((s) => s.id === stageMatch.stageId)?.short || '';
    return {
      pathname,
      pageLabel: 'Parcours — étape',
      sectionLabel: stageMatch.stageLabel,
      pageDetail: `Projet #${stageMatch.projectId}, étape « ${stageMatch.stageLabel} »${short ? ` (${short})` : ''}. Workspace : tâches, liens, contacts et jalons.`,
    };
  }

  const projectMatch = matchProjectDetail(pathname);
  if (projectMatch) {
    return {
      pathname,
      pageLabel: 'Parcours — projet',
      sectionLabel: PROJECT_STAGE_LABELS.idee || 'Informations générales',
      pageDetail: `Fiche projet #${projectMatch.projectId} : synthèse, progression et accès aux étapes.`,
    };
  }

  if (pathname === '/') {
    return {
      pathname,
      pageLabel: 'Accueil',
      sectionLabel: 'Tableau de bord',
      pageDetail: 'Vue d’ensemble : progression, coach d’avancement et prochaine action.',
    };
  }

  if (pathname === '/parcours') {
    return {
      pathname,
      pageLabel: 'Parcours',
      sectionLabel: 'Mes projets',
      pageDetail: 'Liste des projets, création, suppression et accès aux étapes.',
    };
  }

  if (pathname.startsWith('/creer-son-avenir')) {
    return {
      pathname,
      pageLabel: 'Parcours',
      sectionLabel: 'Créer son avenir',
      pageDetail: 'Formulaire initial : idée, lieu et budget pour lancer la recherche IA.',
    };
  }

  if (pathname.startsWith('/projet/recherche')) {
    const params = new URLSearchParams(search);
    const step = params.get('step') || params.get('phase') || '';
    return {
      pathname,
      pageLabel: 'Parcours',
      sectionLabel: 'Recherche de business',
      pageDetail: step
        ? `Écran de recherche (phase : ${step}).`
        : 'Exploration des idées de business, formations et implantations.',
    };
  }

  if (pathname.startsWith('/projet/apercu')) {
    return {
      pathname,
      pageLabel: 'Parcours',
      sectionLabel: 'Aperçu du projet',
      pageDetail: 'Rapport de la proposition retenue, analyse Fabulous et validation avant enregistrement.',
    };
  }

  if (pathname.startsWith('/fil-du-temps')) {
    return {
      pathname,
      pageLabel: 'Fil du temps',
      sectionLabel: 'Historique',
      pageDetail: 'Chronologie des actions, scans et événements du projet.',
    };
  }

  if (pathname.startsWith('/ressources')) {
    return {
      pathname,
      pageLabel: 'Docs',
      sectionLabel: 'Bibliothèque documentaire',
      pageDetail: 'Upload, catégories, scan Fabulous des documents et liens contacts.',
    };
  }

  if (pathname.startsWith('/planner')) {
    return {
      pathname,
      pageLabel: 'Agenda',
      sectionLabel: 'Planning',
      pageDetail: 'Calendrier des rendez-vous et événements liés au projet.',
    };
  }

  if (pathname.startsWith('/competences')) {
    return {
      pathname,
      pageLabel: 'Compétences',
      sectionLabel: 'Formations',
      pageDetail: 'Formations recommandées et suivi des compétences à acquérir.',
    };
  }

  if (pathname.startsWith('/geographie')) {
    return {
      pathname,
      pageLabel: 'Géographie',
      sectionLabel: 'Implantation',
      pageDetail: 'Carte France, évaluation ville et choix du lieu d’implantation.',
    };
  }

  if (pathname.startsWith('/setup')) {
    return {
      pathname,
      pageLabel: 'Setup',
      sectionLabel: 'Mon compte',
      pageDetail: 'Profil, abonnement et paramètres personnels.',
    };
  }

  if (pathname.startsWith('/admin')) {
    return {
      pathname,
      pageLabel: 'Administration',
      sectionLabel: 'Console admin',
      pageDetail: 'Prompts IA, réglages moteur, utilisateurs et configuration plateforme.',
    };
  }

  if (pathname.startsWith('/login')) {
    return {
      pathname,
      pageLabel: 'Connexion',
      sectionLabel: 'Authentification',
      pageDetail: 'Se connecter à un compte existant.',
    };
  }

  if (pathname.startsWith('/register')) {
    return {
      pathname,
      pageLabel: 'Inscription',
      sectionLabel: 'Création de compte',
      pageDetail: 'Créer un compte puis confirmer l’e-mail.',
    };
  }

  if (pathname.startsWith('/confirm-email')) {
    return {
      pathname,
      pageLabel: 'Confirmation e-mail',
      sectionLabel: 'Activation',
      pageDetail: 'Valider l’adresse e-mail via le lien reçu.',
    };
  }

  return {
    pathname,
    pageLabel: 'Kizumai',
    sectionLabel: 'Navigation',
    pageDetail: `Page : ${pathname}${search}${hash}`.slice(0, 800),
  };
}

export function buildPageGuidePayload(location, { project } = {}) {
  const ctx = buildPageGuideContext(location);
  const stageMatch = matchProjectStage(location?.pathname || '');
  const projectMatch = matchProjectDetail(location?.pathname || '');
  const routeProjectId = stageMatch?.projectId || projectMatch?.projectId || null;

  return {
    ...ctx,
    projectId: routeProjectId || project?.id || null,
    projectTitle: project?.title || project?.quoi || null,
    projectStage:
      project?.progress?.currentLabel ||
      project?.progress?.nextLabel ||
      (stageMatch ? stageMatch.stageLabel : null) ||
      project?.stage ||
      null,
  };
}

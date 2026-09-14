import { stageHref } from '../constants/projectStages.js';

const STORAGE_PREFIX = 'kizumai_nextstep_seen';
const CACHE_PREFIX = 'kizumai_advancement_cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Textes pédagogiques par étape du parcours (fallback). */
const STAGE_GUIDES = {
  idee: {
    eyebrow: 'Prochaine étape',
    title: 'Complétez les informations générales',
    body: 'Relisez le titre, le lieu et le budget de votre activité. C’est la base : Fabulous s’en sert pour cadrer la suite du parcours.',
    cta: 'Ouvrir mon projet',
  },
  etude_marche: {
    eyebrow: 'Prochaine étape',
    title: 'Lancez l’étude de marché',
    body: 'Analysez la demande, la concurrence et votre zone. Cette étape transforme votre idée en opportunité chiffrée.',
    cta: 'Aller à l’étude de marché',
  },
  business_plan: {
    eyebrow: 'Prochaine étape',
    title: 'Construisez le business plan',
    body: 'Structurez l’offre, les revenus et les charges. Vous obtiendrez une vision claire de la viabilité du projet.',
    cta: 'Ouvrir le business plan',
  },
  financement: {
    eyebrow: 'Prochaine étape',
    title: 'Travaillez le financement',
    body: 'Identifiez besoins en fonds, aides possibles et plan de trésorerie pour sécuriser le démarrage.',
    cta: 'Voir le financement',
  },
  immatriculation: {
    eyebrow: 'Prochaine étape',
    title: 'Préparez l’immatriculation',
    body: 'Choisissez le statut juridique et les démarches administratives pour officialiser votre activité.',
    cta: 'Voir l’immatriculation',
  },
  lancement: {
    eyebrow: 'Prochaine étape',
    title: 'Préparez le lancement',
    body: 'Dernière ligne droite : checklist opérationnelle, premiers clients et mise en route concrète.',
    cta: 'Voir le lancement',
  },
};

const WELCOME_GUIDE = {
  key: 'welcome',
  eyebrow: 'Parcours activé',
  title: 'Votre activité est créée',
  body: 'Le compte payant est actif. Commencez par les informations générales, puis enchaînez sur l’étude de marché — chaque étape vous guide jusqu’au lancement.',
  cta: 'Commencer le parcours',
  stageId: 'idee',
  source: 'static',
};

function storageKey(userId, projectId, tipKey) {
  return `${STORAGE_PREFIX}:${userId || 'u'}:${projectId || 'p'}:${tipKey}`;
}

function cacheKey(userId, projectId, stageId) {
  return `${CACHE_PREFIX}:${userId || 'u'}:${projectId || 'p'}:${stageId || 'x'}`;
}

export function isNextStepGuideSeen(userId, projectId, tipKey) {
  try {
    return localStorage.getItem(storageKey(userId, projectId, tipKey)) === '1';
  } catch {
    return false;
  }
}

export function markNextStepGuideSeen(userId, projectId, tipKey) {
  try {
    localStorage.setItem(storageKey(userId, projectId, tipKey), '1');
  } catch {
    // ignore
  }
}

export function readAdvancementCache(userId, projectId, stageId) {
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, projectId, stageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.coach) return null;
    if (Date.now() - Number(parsed.at) > CACHE_TTL_MS) return null;
    return parsed.coach;
  } catch {
    return null;
  }
}

export function writeAdvancementCache(userId, projectId, stageId, coach) {
  try {
    sessionStorage.setItem(
      cacheKey(userId, projectId, stageId),
      JSON.stringify({ at: Date.now(), coach })
    );
  } catch {
    // ignore
  }
}

/**
 * Guide statique (fallback / welcome).
 */
export function resolveNextStepGuide(project, { forceWelcome = false } = {}) {
  if (!project?.id) return null;

  const stageId =
    project.progress?.nextStage || project.progress?.currentStage || project.stage || 'idee';
  const stageGuide = STAGE_GUIDES[stageId] || STAGE_GUIDES.idee;

  if (forceWelcome) {
    return {
      ...WELCOME_GUIDE,
      href: stageHref(WELCOME_GUIDE.stageId, project.id),
    };
  }

  return {
    key: `stage:${stageId}`,
    stageId,
    source: 'static',
    ...stageGuide,
    href: stageHref(stageId, project.id),
  };
}

/**
 * Convertit la réponse coach API en guide UI.
 */
export function guideFromAdvancementCoach(project, coach) {
  if (!project?.id || !coach?.primary) return null;

  const stageId =
    coach.railStage ||
    coach.primary.stageId ||
    project.progress?.nextStage ||
    project.stage ||
    'idee';

  const source = coach.source === 'ai' || coach.source === 'memory' ? coach.source : 'static';
  const eyebrow =
    source === 'ai'
      ? 'Fabulous — prochaine action'
      : source === 'memory'
        ? 'Mémoire projet'
        : 'Prochaine étape';

  return {
    key: `stage:${stageId}`,
    stageId,
    source,
    eyebrow,
    title: coach.primary.title || STAGE_GUIDES[stageId]?.title || 'Continuer le parcours',
    body: coach.primary.body || STAGE_GUIDES[stageId]?.body || '',
    cta: coach.primary.cta || STAGE_GUIDES[stageId]?.cta || 'Continuer',
    href: stageHref(stageId, project.id),
    secondary: Array.isArray(coach.secondary) ? coach.secondary : [],
    keyFacts: Array.isArray(coach.keyFacts) ? coach.keyFacts : [],
  };
}

export function railStageId(project) {
  return project?.progress?.nextStage || project?.progress?.currentStage || project?.stage || 'idee';
}

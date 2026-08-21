export const PROJECT_STAGES = [
  {
    id: 'idee',
    title: 'Informations générales',
    short: 'Idée',
    path: (projectId) => `/projet/${projectId}`,
  },
  {
    id: 'etude_marche',
    title: 'Étude de marché',
    short: 'Marché',
    path: (projectId) => `/projet/${projectId}/etape/etude_marche`,
  },
  {
    id: 'business_plan',
    title: 'Business plan',
    short: 'BP',
    path: (projectId) => `/projet/${projectId}/etape/business_plan`,
  },
  {
    id: 'financement',
    title: 'Financement',
    short: 'Finance',
    path: (projectId) => `/projet/${projectId}/etape/financement`,
  },
  {
    id: 'immatriculation',
    title: 'Immatriculation',
    short: 'Immat.',
    path: (projectId) => `/projet/${projectId}/etape/immatriculation`,
  },
  {
    id: 'lancement',
    title: 'Lancement',
    short: 'Lancement',
    path: (projectId) => `/projet/${projectId}/etape/lancement`,
  },
];

export const PROJECT_STAGE_IDS = PROJECT_STAGES.map((s) => s.id);

export const PROJECT_STAGE_LABELS = Object.fromEntries(
  PROJECT_STAGES.map((s) => [s.id, s.title])
);

export function stageHref(stageId, projectId) {
  if (!projectId) return '/creer-son-avenir';
  const stage = PROJECT_STAGES.find((s) => s.id === stageId) || PROJECT_STAGES[0];
  return stage.path(projectId);
}

export function nextStageId(stageId) {
  const i = PROJECT_STAGE_IDS.indexOf(stageId);
  if (i < 0 || i >= PROJECT_STAGE_IDS.length - 1) return null;
  return PROJECT_STAGE_IDS[i + 1];
}

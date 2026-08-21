export const PROJECT_STAGE_IDS = [
  'idee',
  'etude_marche',
  'business_plan',
  'financement',
  'immatriculation',
  'lancement',
];

export const PROJECT_STAGE_LABELS = {
  idee: 'Informations générales',
  etude_marche: 'Étude de marché',
  business_plan: 'Business plan',
  financement: 'Financement',
  immatriculation: 'Immatriculation',
  lancement: 'Lancement',
};

export const PROJECT_STAGE_SHORT_LABELS = {
  idee: 'Idée',
  etude_marche: 'Marché',
  business_plan: 'BP',
  financement: 'Finance',
  immatriculation: 'Immat.',
  lancement: 'Lancement',
};

/**
 * Avancement global à partir de l'étape projet + runs existants (sans les créer).
 */
export function computeProjectProgress(project, runs = []) {
  const stages = PROJECT_STAGE_IDS;
  const total = stages.length;
  const currentId = stages.includes(project?.stage) ? project.stage : 'idee';
  const index = Math.max(0, stages.indexOf(currentId));
  const runByStage = new Map((runs || []).map((r) => [r.stage, r]));

  const intraOf = (stageId, i) => {
    const run = runByStage.get(stageId);
    if (!run) return i < index ? 100 : 0;
    if (run.status === 'completed') return 100;
    const n = Number(run.progressPercent);
    if (Number.isNaN(n)) return i < index ? 100 : 0;
    return Math.min(100, Math.max(0, n));
  };

  let percent;
  if (project?.status === 'launched') {
    percent = 100;
  } else {
    const completedBefore = index;
    const intra = intraOf(currentId, index);
    percent = Math.round(((completedBefore + intra / 100) / total) * 100);
  }
  percent = Math.min(100, Math.max(0, percent));
  if (project?.id && percent === 0) {
    percent = Math.round(100 / (total * 2));
  }

  const steps = stages.map((id, i) => {
    const intra = intraOf(id, i);
    let status = 'upcoming';
    if (i < index || intra >= 100) status = 'done';
    else if (i === index) status = 'current';
    return {
      id,
      label: PROJECT_STAGE_SHORT_LABELS[id] || id,
      fullLabel: PROJECT_STAGE_LABELS[id] || id,
      status,
      progressPercent: intra,
    };
  });

  const currentStep = steps[index];
  const nextUpcoming = steps.find((s) => s.status === 'upcoming');
  const nextStep = currentStep?.status === 'done' ? nextUpcoming || currentStep : currentStep;

  return {
    percent,
    currentStage: currentId,
    currentLabel: PROJECT_STAGE_LABELS[currentId],
    nextStage: nextStep?.id || currentId,
    nextLabel: nextStep?.fullLabel || PROJECT_STAGE_LABELS[currentId],
    steps,
  };
}

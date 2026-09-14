import {
  PROJECT_STAGE_IDS,
  PROJECT_STAGE_LABELS,
} from '../constants/projectStages.js';

/** Textes pédagogiques (fallback si mémoire / IA indisponible). */
export const STAGE_ADVANCEMENT_FALLBACK = {
  idee: {
    title: 'Complétez les informations générales',
    body: 'Relisez le titre, le lieu et le budget de votre activité. C’est la base : Fabulous s’en sert pour cadrer la suite du parcours.',
    cta: 'Ouvrir mon projet',
  },
  etude_marche: {
    title: 'Lancez l’étude de marché',
    body: 'Analysez la demande, la concurrence et votre zone. Cette étape transforme votre idée en opportunité chiffrée.',
    cta: 'Aller à l’étude de marché',
  },
  business_plan: {
    title: 'Construisez le business plan',
    body: 'Structurez l’offre, les revenus et les charges. Vous obtiendrez une vision claire de la viabilité du projet.',
    cta: 'Ouvrir le business plan',
  },
  financement: {
    title: 'Travaillez le financement',
    body: 'Identifiez besoins en fonds, aides possibles et plan de trésorerie pour sécuriser le démarrage.',
    cta: 'Voir le financement',
  },
  immatriculation: {
    title: 'Préparez l’immatriculation',
    body: 'Choisissez le statut juridique et les démarches administratives pour officialiser votre activité.',
    cta: 'Voir l’immatriculation',
  },
  lancement: {
    title: 'Préparez le lancement',
    body: 'Dernière ligne droite : checklist opérationnelle, premiers clients et mise en route concrète.',
    cta: 'Voir le lancement',
  },
};

function railStageOf(project) {
  const fromProgress = project?.progress?.nextStage || project?.progress?.currentStage;
  if (PROJECT_STAGE_IDS.includes(fromProgress)) return fromProgress;
  if (PROJECT_STAGE_IDS.includes(project?.stage)) return project.stage;
  return 'idee';
}

function staticPrimary(stageId) {
  const fb = STAGE_ADVANCEMENT_FALLBACK[stageId] || STAGE_ADVANCEMENT_FALLBACK.idee;
  return {
    stageId,
    stageLabel: PROJECT_STAGE_LABELS[stageId] || stageId,
    title: fb.title,
    body: fb.body,
    cta: fb.cta,
  };
}

function coachIntent(stageId, stageLabel, project) {
  const title = project?.title || project?.quoi || 'projet';
  return [
    `Coach d’avancement Kizumai pour le porteur du projet « ${String(title).slice(0, 120)} ».`,
    `RAIL OBLIGATOIRE : l’action prioritaire doit avancer l’étape « ${stageId} » (${stageLabel}).`,
    'Ne propose jamais de sauter une étape du parcours (idée → marché → BP → financement → immat. → lancement).',
    'Réponds avec un résumé court de situation, des faits utiles, et des prochaines actions concrètes.',
    'La première next_action doit être réalisable dans l’étape rail ; les suivantes peuvent être des renforts (compétences, lieu, agenda, documents).',
  ].join(' ');
}

/**
 * Moteur d’avancement : mémoire + IA, rail = progression parcours.
 */
export function createAdvancementCoachService({ projectMemoryRecallService = null }) {
  return {
    /**
     * @param {object} project — projet avec `progress` déjà calculé
     */
    async buildForProject(project) {
      const stageId = railStageOf(project);
      const stageLabel = PROJECT_STAGE_LABELS[stageId] || stageId;
      const primaryStatic = staticPrimary(stageId);

      const base = {
        projectId: project.id,
        railStage: stageId,
        railLabel: stageLabel,
        primary: primaryStatic,
        secondary: [],
        keyFacts: [],
        summary: null,
        empty: false,
        source: 'static',
      };

      if (!projectMemoryRecallService) {
        return base;
      }

      try {
        const situation = await projectMemoryRecallService.summarizeSituation(project.id, {
          intent: coachIntent(stageId, stageLabel, project),
        });

        if (situation?.empty) {
          return { ...base, empty: true, source: 'static' };
        }

        const actions = Array.isArray(situation.nextActions)
          ? situation.nextActions.map((a) => String(a || '').trim()).filter(Boolean)
          : [];
        const summary = String(situation.summary || '').trim();
        const keyFacts = Array.isArray(situation.keyFacts)
          ? situation.keyFacts.map((f) => String(f || '').trim()).filter(Boolean).slice(0, 4)
          : [];

        const bodyParts = [];
        if (summary) bodyParts.push(summary.slice(0, 520));
        if (actions[0]) bodyParts.push(actions[0].slice(0, 280));
        const body = bodyParts.join('\n\n') || primaryStatic.body;

        const secondary = actions.slice(1, 3).map((text) => ({ text: text.slice(0, 220) }));

        return {
          ...base,
          source: situation.source === 'ai' ? 'ai' : situation.source === 'fallback' ? 'memory' : 'static',
          summary: summary || null,
          keyFacts,
          primary: {
            ...primaryStatic,
            title:
              stageLabel && summary
                ? `Prochaine étape : ${stageLabel}`
                : primaryStatic.title,
            body,
          },
          secondary,
          empty: false,
          provider: situation.provider || null,
          model: situation.model || null,
        };
      } catch (err) {
        console.warn(`[advancement] fallback statique : ${err.message || err}`);
        return base;
      }
    },
  };
}

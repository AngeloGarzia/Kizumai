import { COMPETITION_SEGMENT_COUNT, competitionSegments } from '../utils/competitionPill.js';
import {
  PROFITABILITY_SEGMENT_COUNT,
  profitabilitySegments,
} from '../utils/profitabilityPill.js';
import {
  FEASIBILITY_SEGMENT_COUNT,
  feasibilityLabel,
  feasibilitySegments,
} from '../components/FeasibilityGauge.jsx';

/**
 * Contenu détaillé pour la popup d’explication d’une pastille métrique.
 */
export function buildMetricPillDetail(kind, payload = {}) {
  if (kind === 'competition') {
    const score = payload.score;
    const filled = competitionSegments(score);
    return {
      kind,
      title: 'Concurrence',
      eyebrow: 'Densité concurrentielle',
      scoreLabel:
        filled == null
          ? 'n/d'
          : `${filled}/${COMPETITION_SEGMENT_COUNT} · ${payload.label || '—'}`,
      headline:
        score != null
          ? `Score ${score}/100 — ${payload.label || 'intensité estimée'}`
          : 'Score non disponible',
      summary:
        payload.note ||
        'Estimation de la pression concurrentielle (acteurs similaires, saturation du marché).',
      calcTitle: 'Comment le score est calculé',
      calcSteps: [
        'L’IA évalue la densité concurrentielle locale ou sectorielle pour cette idée (0 à 100).',
        '0–24 : Faible / niche ouverte · 25–49 : Modérée · 50–74 : Forte · 75–100 : Très forte / saturée.',
        `Affichage pastille : ${COMPETITION_SEGMENT_COUNT} segments — score ${score ?? '—'} → ${
          filled == null ? 'n/d' : `${filled} segment(s) rempli(s)`
        }.`,
        payload.source === 'web'
          ? 'Source : estimation enrichie par recherche web.'
          : payload.source === 'estimated'
            ? 'Source : estimation sans recherche web dédiée.'
            : 'Source : estimation Fabulous.',
      ],
      meaningTitle: 'Ce que ça veut dire pour vous',
      meaning:
        score == null
          ? 'Pas encore assez d’éléments pour juger la concurrence.'
          : score <= 24
            ? 'Peu d’acteurs directs : place plus libre, mais à valider sur le terrain.'
            : score <= 49
              ? 'Concurrence présente : différenciation et ciblage seront décisifs.'
              : score <= 74
                ? 'Marché chargé : il faudra un angle net (offre, prix, niche, canal).'
                : 'Marché saturé : rentabilité et positionnement doivent être très solides.',
    };
  }

  if (kind === 'profitability') {
    const score = payload.score;
    const filled = profitabilitySegments(score);
    return {
      kind,
      title: 'Rentabilité',
      eyebrow: 'Rentabilité future réelle et sérieuse',
      scoreLabel:
        filled == null
          ? 'n/d'
          : `${filled}/${PROFITABILITY_SEGMENT_COUNT} · ${payload.label || '—'}`,
      headline:
        score != null
          ? `Score ${score}/100 — ${payload.label || 'niveau estimé'}`
          : 'Score non disponible',
      summary:
        payload.note ||
        'Estimation du retour crédible (marge, capacité à générer des bénéfices), pas du confort de trésorerie.',
      calcTitle: 'Comment le score est calculé',
      calcSteps: [
        'L’IA estime la rentabilité future probable, réelle et sérieuse (ROI / marge crédibles).',
        '0–24 : Fragile · 25–49 : Limitée · 50–74 : Plausible · 75–100 : Solide.',
        `Affichage pastille : ${PROFITABILITY_SEGMENT_COUNT} segments — score ${score ?? '—'} → ${
          filled == null ? 'n/d' : `${filled} segment(s) rempli(s)`
        }.`,
        'Un budget trop élevé pour le besoin du modèle plafonne ou baisse ce score : l’argent en trop n’améliore pas le ROI.',
      ],
      meaningTitle: 'Ce que ça veut dire pour vous',
      meaning:
        score == null
          ? 'Pas encore assez d’éléments pour juger la rentabilité.'
          : score <= 24
            ? 'Retour sérieux peu crédible tel quel — revoir offre, coûts ou positionnement.'
            : score <= 49
              ? 'Rentabilité limitée : possible, mais exige une exécution très serrée.'
              : score <= 74
                ? 'Rentabilité plausible si le plan d’action et les coûts restent disciplinés.'
                : 'Rentabilité solide dans le scénario proposé — à confirmer avec des chiffres terrain.',
    };
  }

  // feasibility
  const score = payload.score;
  const label = feasibilityLabel(score);
  const filled = feasibilitySegments(score);
  const pct = score != null ? Math.round(Number(score)) : null;
  return {
    kind: 'feasibility',
    title: 'Faisabilité',
    eyebrow: 'Chance de lancement / réussite opérationnelle',
    scoreLabel:
      filled == null
        ? 'n/d'
        : `${filled}/${FEASIBILITY_SEGMENT_COUNT}${pct != null ? ` · ${pct} %` : ''}`,
    headline:
      pct != null ? `${pct} % — ${label}` : 'Score non disponible',
    summary:
      'Mesure la lançabilité du concept (mettre le projet sur pied), en tenant compte d’une rentabilité future réaliste — pas seulement « assez d’argent pour démarrer ».',
    calcTitle: 'Comment le score est calculé',
    calcSteps: [
      'L’IA attribue un score de réussite opérationnelle 0–100 propre à cette idée.',
      '0–33 : Faudra cravacher · 34–66 : Ça se joue · 67–100 : Projet réalisable plus facilement.',
      `Affichage pastille : ${FEASIBILITY_SEGMENT_COUNT} segments — score ${pct ?? '—'} → ${
        filled == null ? 'n/d' : `${filled} segment(s) rempli(s)`
      } (le % exact reste visible ici).`,
      'Le score intègre la complexité, le marché et une rentabilité future sérieuse plausible.',
      'Un budget trop élevé pour le besoin du concept ne doit pas gonfler ce score (surinvestissement ≠ succès).',
      Array.isArray(payload.modes) && payload.modes.length
        ? `Modes proposés : ${payload.modes
            .map((m) => `${m.label || m.type}${m.feasibility != null ? ` (${m.feasibility}%)` : ''}`)
            .join(' · ')}.`
        : null,
    ].filter(Boolean),
    meaningTitle: 'Ce que ça veut dire pour vous',
    meaning:
      score == null
        ? 'Pas encore assez d’éléments pour juger la faisabilité.'
        : score <= 33
          ? 'Lancement difficile : prévoyez plus d’effort, de compétences ou de phasage.'
          : score <= 66
            ? 'Faisable avec un effort net : priorisez les freins (compétences, coûts, marché).'
            : 'Lancement relativement réaliste dans le scénario proposé — reste à exécuter proprement.',
  };
}

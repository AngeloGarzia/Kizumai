/**
 * Contenu détaillé pour la popup d’une pastille métrique.
 * Explications métier liées au business — pas de détail technique d’attribution de score.
 */

function businessLabel(payload = {}) {
  const title = String(payload.businessTitle || payload.title || '').trim();
  return title || 'ce projet';
}

function activityBit(payload = {}) {
  const a = String(payload.activity || '').trim();
  return a ? ` (${a})` : '';
}

function competitionMeaning(score, name) {
  if (score == null) {
    return `Pas encore assez d’éléments pour juger la concurrence autour de « ${name} ».`;
  }
  if (score <= 24) {
    return `Pour « ${name} », peu d’acteurs directs semblent occuper le même créneau : la place est plus libre, à confirmer sur le terrain (clients, canaux, offre).`;
  }
  if (score <= 49) {
    return `Pour « ${name} », des concurrents existent déjà : la différenciation (offre, cible, canal, prix) sera décisive pour vous faire une place.`;
  }
  if (score <= 74) {
    return `Pour « ${name} », le marché est déjà bien chargé : il faudra un angle net (niche, service, positionnement) pour ne pas se battre uniquement sur le prix.`;
  }
  return `Pour « ${name} », le créneau paraît saturé : sans positionnement très clair et une exécution serrée, la pression concurrentielle sera forte.`;
}

function profitabilityMeaning(score, name) {
  if (score == null) {
    return `Pas encore assez d’éléments pour juger la rentabilité de « ${name} ».`;
  }
  if (score <= 24) {
    return `Pour « ${name} », un retour sérieux paraît peu crédible tel quel : revoir l’offre, les coûts ou le positionnement avant d’engager trop de budget.`;
  }
  if (score <= 49) {
    return `Pour « ${name} », la rentabilité est limitée : possible, mais seulement avec une exécution très disciplinée (marges, coûts fixes, acquisition).`;
  }
  if (score <= 74) {
    return `Pour « ${name} », une rentabilité crédible est plausible si le plan d’action et les coûts restent sous contrôle.`;
  }
  return `Pour « ${name} », le scénario laisse entrevoir une rentabilité solide — à confirmer avec des chiffres terrain (prix, volumes, charges).`;
}

function feasibilityMeaning(score, name) {
  if (score == null) {
    return `Pas encore assez d’éléments pour juger la lançabilité de « ${name} ».`;
  }
  if (score <= 33) {
    return `Lancer « ${name} » sera exigeant : prévoyez plus d’effort, de compétences ou un phasage progressif.`;
  }
  if (score <= 66) {
    return `« ${name} » est lançable avec un effort net : priorisez les freins concrets (compétences, coûts, accès marché, réglementation).`;
  }
  return `« ${name} » paraît relativement réaliste à mettre sur pied dans le scénario proposé — reste à exécuter proprement.`;
}

function modeAngles(payload = {}) {
  if (!Array.isArray(payload.modes)) return [];
  return payload.modes
    .map((m) => {
      const label = m.label || m.type || '';
      const angle = String(m.angle || '').trim();
      if (!label && !angle) return null;
      if (label && angle) return `${label} : ${angle}`;
      return label || angle;
    })
    .filter(Boolean);
}

/**
 * @param {'competition'|'profitability'|'feasibility'} kind
 * @param {object} payload score, label, note, businessTitle, activity, pitch, rationale, modes…
 */
export function buildMetricPillDetail(kind, payload = {}) {
  const name = businessLabel(payload);
  const activity = activityBit(payload);
  const note = String(payload.note || '').trim() || null;
  const pitch = String(payload.pitch || '').trim() || null;
  const rationale = String(payload.rationale || '').trim() || null;
  const score = payload.score;
  const label = payload.label || null;

  if (kind === 'competition') {
    const points = [];
    if (note) points.push(note);
    if (pitch) points.push(`Le concept : ${pitch}`);
    if (rationale) points.push(rationale);
    if (!points.length) {
      points.push(
        `Fabulous évalue la pression concurrentielle propre à « ${name} »${activity}, pas un score générique du secteur.`
      );
    }

    return {
      kind,
      title: 'Concurrence',
      eyebrow: `Pour « ${name} »`,
      headline: label
        ? `Niveau : ${label}`
        : score != null
          ? 'Intensité estimée pour ce business'
          : 'Score non disponible',
      summary: note
        ? note
        : `Lecture de la concurrence autour de « ${name} »${activity}.`,
      explainTitle: 'Ce que ça veut dire pour ce business',
      explainPoints: points,
      meaningTitle: 'En pratique',
      meaning: competitionMeaning(score, name),
    };
  }

  if (kind === 'profitability') {
    const points = [];
    if (note) points.push(note);
    if (pitch) points.push(`Le concept : ${pitch}`);
    if (rationale) points.push(rationale);
    if (!points.length) {
      points.push(
        `Fabulous estime la rentabilité future crédible de « ${name} »${activity} (marge, retour, capacité à générer des bénéfices), pas le confort de trésorerie.`
      );
    }

    return {
      kind,
      title: 'Rentabilité',
      eyebrow: `Pour « ${name} »`,
      headline: label
        ? `Niveau : ${label}`
        : score != null
          ? 'Rentabilité estimée pour ce business'
          : 'Score non disponible',
      summary: note
        ? note
        : `Lecture de la rentabilité sérieuse de « ${name} »${activity}.`,
      explainTitle: 'Ce que ça veut dire pour ce business',
      explainPoints: points,
      meaningTitle: 'En pratique',
      meaning: profitabilityMeaning(score, name),
    };
  }

  // feasibility
  const points = [];
  if (note) points.push(note);
  if (rationale) points.push(rationale);
  if (pitch) points.push(`Le concept : ${pitch}`);
  const angles = modeAngles(payload);
  if (angles.length) {
    points.push(`Angles d’implantation : ${angles.join(' · ')}`);
  }
  if (!points.length) {
    points.push(
      `Fabulous juge la chance de mettre « ${name} »${activity} sur pied (lancement opérationnel), en tenant compte d’une rentabilité future réaliste.`
    );
  }

  const pct = score != null ? Math.round(Number(score)) : null;

  return {
    kind: 'feasibility',
    title: 'Faisabilité',
    eyebrow: `Pour « ${name} »`,
    headline:
      label ||
      (pct != null
        ? `Chance de lancement estimée pour ce business`
        : 'Score non disponible'),
    summary: note
      ? note
      : `Lecture de la lançabilité de « ${name} »${activity}.`,
    explainTitle: 'Ce que ça veut dire pour ce business',
    explainPoints: points,
    meaningTitle: 'En pratique',
    meaning: feasibilityMeaning(score, name),
  };
}

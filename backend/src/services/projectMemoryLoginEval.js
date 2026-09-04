/**
 * Heuristique pure : décide si le contexte mémoire projet est stale.
 * Pas d'appel IA ici — uniquement des signaux structurés.
 */

/**
 * @param {object} input
 * @param {object|null} input.snapshot
 * @param {number} input.activeNodeCount
 * @param {Date|string|null} [input.projectUpdatedAt]
 * @param {number} [input.eventThreshold=8]
 * @param {number} [input.maxAgeHours=24]
 * @param {Date} [input.now]
 * @returns {{ decision: 'fresh'|'full', reasons: string[], score: number }}
 */
export function evaluateProjectContextFreshness({
  snapshot = null,
  activeNodeCount = 0,
  projectUpdatedAt = null,
  eventThreshold = 8,
  maxAgeHours = 24,
  now = new Date(),
} = {}) {
  const reasons = [];
  let score = 0;

  const nodes = Number(activeNodeCount) || 0;
  if (nodes <= 0) {
    reasons.push('no_memory_nodes');
    score += 40;
  }

  if (!snapshot || !String(snapshot.summary || '').trim()) {
    reasons.push('missing_or_empty_snapshot');
    score += 40;
  } else {
    const events = Number(snapshot.eventsSinceSnapshot) || 0;
    const threshold = Math.max(1, Number(eventThreshold) || 8);
    if (events >= threshold) {
      reasons.push('events_over_threshold');
      score += 30;
    }

    const generatedAt = snapshot.generatedAt ? new Date(snapshot.generatedAt) : null;
    const maxAge = Math.max(1, Number(maxAgeHours) || 24);
    if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
      const ageHours = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
      if (ageHours >= maxAge) {
        reasons.push('snapshot_too_old');
        score += 25;
      }

      if (projectUpdatedAt) {
        const updated = new Date(projectUpdatedAt);
        if (!Number.isNaN(updated.getTime()) && updated.getTime() > generatedAt.getTime()) {
          reasons.push('project_updated_after_snapshot');
          score += 20;
        }
      }
    } else {
      reasons.push('invalid_snapshot_date');
      score += 20;
    }
  }

  if (reasons.length > 0) {
    return { decision: 'full', reasons, score: Math.min(100, score) };
  }

  return { decision: 'fresh', reasons, score: 0 };
}

/**
 * @param {Date|string|null} lastEvalAt
 * @param {number} minIntervalHours
 * @param {Date} [now]
 */
export function isWithinLoginEvalInterval(lastEvalAt, minIntervalHours, now = new Date()) {
  if (!lastEvalAt) return false;
  const last = new Date(lastEvalAt);
  if (Number.isNaN(last.getTime())) return false;
  const minHours = Math.max(0, Number(minIntervalHours) || 0);
  if (minHours <= 0) return false;
  const elapsedHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  return elapsedHours < minHours;
}

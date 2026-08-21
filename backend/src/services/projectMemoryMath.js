/**
 * Fonctions pures de la mémoire projet (testables sans DB).
 */

export function computeDecayedImportance({
  importance,
  decayRate,
  hoursSinceAccess,
}) {
  const days = Math.max(0, Number(hoursSinceAccess) || 0) / 24;
  const factor = Math.max(0, 1 - Number(decayRate) * days);
  return Math.max(0, Math.min(1, Number(importance) * factor));
}

export function shouldArchive(importance, threshold = 0.05) {
  return Number(importance) < Number(threshold);
}

export function reinforceImportance(importance, boost = 0.05) {
  return Math.min(1, Math.round((Number(importance) + Number(boost)) * 1000) / 1000);
}

export function reinforceWeight(weight, boost = 0.08) {
  return Math.min(1, Math.round((Number(weight) + Number(boost)) * 1000) / 1000);
}

/**
 * Assemble un contexte de rappel borné en caractères.
 */
export function assembleRecallContext({
  snapshot = null,
  nodes = [],
  edges = [],
  intent = '',
  maxChars = 4000,
} = {}) {
  const parts = [];

  if (intent) {
    parts.push(`Intent: ${intent}`);
  }

  if (snapshot?.summary) {
    parts.push(`## Snapshot\n${snapshot.summary}`);
    if (Array.isArray(snapshot.keyFacts) && snapshot.keyFacts.length) {
      parts.push(`Faits clés: ${snapshot.keyFacts.slice(0, 8).join(' · ')}`);
    }
    if (Array.isArray(snapshot.activeBlockers) && snapshot.activeBlockers.length) {
      parts.push(`Blocages: ${snapshot.activeBlockers.slice(0, 5).join(' · ')}`);
    }
    if (Array.isArray(snapshot.nextActions) && snapshot.nextActions.length) {
      parts.push(`Prochaines actions: ${snapshot.nextActions.slice(0, 5).join(' · ')}`);
    }
  }

  if (nodes.length) {
    const lines = nodes.slice(0, 20).map((n) => {
      const imp = n.importance != null ? Number(n.importance).toFixed(2) : '?';
      return `- [${n.nodeType}|imp=${imp}] ${n.content}`;
    });
    parts.push(`## Souvenirs\n${lines.join('\n')}`);
  }

  if (edges.length) {
    const edgeLines = edges.slice(0, 15).map(
      (e) =>
        `- ${String(e.sourceNodeId).slice(0, 8)} --${e.relationType}(${Number(e.weight).toFixed(2)})--> ${String(e.targetNodeId).slice(0, 8)}`
    );
    parts.push(`## Liens\n${edgeLines.join('\n')}`);
  }

  let text = parts.join('\n\n').trim();
  let truncated = false;
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars - 1)}…`;
    truncated = true;
  }

  return {
    text,
    truncated,
    charCount: text.length,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    hasSnapshot: Boolean(snapshot?.summary),
    snapshot,
    nodes,
    edges,
  };
}

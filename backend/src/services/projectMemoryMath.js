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

export function classifyMemoryKind({ sourceEntityType = null, nodeType = 'event' } = {}) {
  const source = String(sourceEntityType || '').toLowerCase();
  const type = String(nodeType || '').toLowerCase();
  if (['project', 'company', 'accounting_profile', 'company_officer'].includes(source)) {
    return 'permanent';
  }
  if (['decision', 'milestone'].includes(type)) {
    return 'durable';
  }
  if (['task_state', 'event'].includes(type)) {
    return 'temporary';
  }
  return 'durable';
}

export function classifyMemorySensitivity(content = '') {
  const text = String(content || '').toLowerCase();
  const confidentialPatterns = [
    /\b(iban|bic|rib|carte bancaire|num[eé]ro de carte|cvv|mot de passe|password|secret|token)\b/,
    /\b(salaire|revenu personnel|imp[oô]t|dette|cr[eé]dit personnel|patrimoine)\b/,
    /\b(sant[eé]|m[eé]dical|handicap|maladie)\b/,
  ];
  if (confidentialPatterns.some((pattern) => pattern.test(text))) {
    return 'confidential';
  }

  const personalPatterns = [
    /\b(email|e-mail|t[eé]l[eé]phone|adresse personnelle|date de naissance)\b/,
    /\b(nom de famille|pr[eé]nom|pi[eè]ce d'identit[eé]|passeport)\b/,
  ];
  if (personalPatterns.some((pattern) => pattern.test(text))) {
    return 'personal';
  }

  return 'normal';
}

export function shouldExposeMemoryNode(node, { includeSensitive = false } = {}) {
  if (!node) return false;
  if (includeSensitive) return true;
  return !['personal', 'confidential'].includes(String(node.sensitivity || 'normal'));
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
  includeSensitive = false,
} = {}) {
  const parts = [];
  const visibleNodes = nodes.filter((node) => shouldExposeMemoryNode(node, { includeSensitive }));

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

  if (visibleNodes.length) {
    const lines = visibleNodes.slice(0, 20).map((n) => {
      const imp = n.importance != null ? Number(n.importance).toFixed(2) : '?';
      const kind = n.memoryKind ? `|${n.memoryKind}` : '';
      return `- [${n.nodeType}${kind}|imp=${imp}] ${n.content}`;
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
    nodeCount: visibleNodes.length,
    edgeCount: edges.length,
    hasSnapshot: Boolean(snapshot?.summary),
    snapshot,
    nodes: visibleNodes,
    edges,
  };
}

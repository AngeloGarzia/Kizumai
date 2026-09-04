import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProjectContextFreshness,
  isWithinLoginEvalInterval,
} from '../src/services/projectMemoryLoginEval.js';

describe('projectMemoryLoginEval', () => {
  const now = new Date('2026-08-29T10:00:00.000Z');

  it('demande un scan si aucune mémoire', () => {
    const result = evaluateProjectContextFreshness({
      snapshot: null,
      activeNodeCount: 0,
      now,
    });
    assert.equal(result.decision, 'full');
    assert.ok(result.reasons.includes('no_memory_nodes'));
    assert.ok(result.reasons.includes('missing_or_empty_snapshot'));
  });

  it('reste fresh si snapshot récent et sans événements', () => {
    const result = evaluateProjectContextFreshness({
      snapshot: {
        summary: 'Contexte OK',
        eventsSinceSnapshot: 0,
        generatedAt: new Date('2026-08-29T08:00:00.000Z'),
      },
      activeNodeCount: 12,
      projectUpdatedAt: new Date('2026-08-29T07:00:00.000Z'),
      eventThreshold: 8,
      maxAgeHours: 24,
      now,
    });
    assert.equal(result.decision, 'fresh');
    assert.equal(result.score, 0);
  });

  it('scan si événements au-dessus du seuil', () => {
    const result = evaluateProjectContextFreshness({
      snapshot: {
        summary: 'Contexte',
        eventsSinceSnapshot: 10,
        generatedAt: new Date('2026-08-29T08:00:00.000Z'),
      },
      activeNodeCount: 5,
      eventThreshold: 8,
      maxAgeHours: 24,
      now,
    });
    assert.equal(result.decision, 'full');
    assert.ok(result.reasons.includes('events_over_threshold'));
  });

  it('scan si projet modifié après le snapshot', () => {
    const result = evaluateProjectContextFreshness({
      snapshot: {
        summary: 'Contexte',
        eventsSinceSnapshot: 0,
        generatedAt: new Date('2026-08-29T08:00:00.000Z'),
      },
      activeNodeCount: 5,
      projectUpdatedAt: new Date('2026-08-29T09:30:00.000Z'),
      maxAgeHours: 24,
      now,
    });
    assert.equal(result.decision, 'full');
    assert.ok(result.reasons.includes('project_updated_after_snapshot'));
  });

  it('respecte l’intervalle mini entre évaluations', () => {
    assert.equal(
      isWithinLoginEvalInterval(new Date('2026-08-29T02:00:00.000Z'), 12, now),
      true
    );
    assert.equal(
      isWithinLoginEvalInterval(new Date('2026-08-28T10:00:00.000Z'), 12, now),
      false
    );
    assert.equal(isWithinLoginEvalInterval(null, 12, now), false);
  });
});

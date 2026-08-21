import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assembleRecallContext } from '../src/services/projectMemoryMath.js';

/**
 * Tests d’assemblage recall (service) — logique sans DB.
 * Les upsert/renforcement DB sont couverts via la math + contrat repository.
 */
describe('projectMemoryRecall assembly', () => {
  it('priorise snapshot + nœuds dans le texte', () => {
    const ctx = assembleRecallContext({
      intent: 'suggestion business plan',
      snapshot: {
        summary: 'Café Lyon, étude avancée.',
        keyFacts: ['SIRET en cours'],
        activeBlockers: [],
        nextActions: ['Rédiger BP'],
      },
      nodes: [
        { id: '1', nodeType: 'decision', content: 'Choix micro-entreprise', importance: 0.9 },
        { id: '2', nodeType: 'fact', content: 'Document bail uploadé', importance: 0.5 },
      ],
      edges: [],
      maxChars: 4000,
    });

    assert.match(ctx.text, /suggestion business plan/);
    assert.match(ctx.text, /Café Lyon/);
    assert.match(ctx.text, /Choix micro-entreprise/);
    assert.equal(ctx.nodeCount, 2);
    assert.equal(ctx.truncated, false);
  });
});

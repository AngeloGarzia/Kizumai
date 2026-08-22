import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleRecallContext,
  classifyMemoryKind,
  classifyMemorySensitivity,
  computeDecayedImportance,
  reinforceImportance,
  reinforceWeight,
  shouldExposeMemoryNode,
  shouldArchive,
} from '../src/services/projectMemoryMath.js';

describe('projectMemoryMath', () => {
  it('renforce importance sans dépasser 1', () => {
    assert.equal(reinforceImportance(0.9, 0.05), 0.95);
    assert.equal(reinforceImportance(0.98, 0.05), 1);
  });

  it('renforce weight d’arête', () => {
    assert.equal(reinforceWeight(0.5, 0.08), 0.58);
    assert.equal(reinforceWeight(0.95, 0.08), 1);
  });

  it('applique la décroissance selon le temps', () => {
    // 24h, decay 0.01 → factor 0.99
    const next = computeDecayedImportance({
      importance: 1,
      decayRate: 0.01,
      hoursSinceAccess: 24,
    });
    assert.ok(Math.abs(next - 0.99) < 1e-9);

    const week = computeDecayedImportance({
      importance: 1,
      decayRate: 0.01,
      hoursSinceAccess: 24 * 100,
    });
    assert.equal(week, 0);
  });

  it('archive sous le seuil', () => {
    assert.equal(shouldArchive(0.04, 0.05), true);
    assert.equal(shouldArchive(0.05, 0.05), false);
    assert.equal(shouldArchive(0.2, 0.05), false);
  });

  it('classe les souvenirs permanents, durables et temporaires', () => {
    assert.equal(classifyMemoryKind({ sourceEntityType: 'project', nodeType: 'fact' }), 'permanent');
    assert.equal(classifyMemoryKind({ nodeType: 'decision' }), 'durable');
    assert.equal(classifyMemoryKind({ nodeType: 'event' }), 'temporary');
  });

  it('détecte la sensibilité des souvenirs avant rappel IA', () => {
    assert.equal(classifyMemorySensitivity('Budget public estimé à 15000 euros'), 'normal');
    assert.equal(classifyMemorySensitivity('Email du contact : test@example.com'), 'personal');
    assert.equal(classifyMemorySensitivity('IBAN fourni pour le paiement'), 'confidential');
  });

  it('masque par défaut les souvenirs personnels ou confidentiels', () => {
    assert.equal(shouldExposeMemoryNode({ sensitivity: 'normal' }), true);
    assert.equal(shouldExposeMemoryNode({ sensitivity: 'personal' }), false);
    assert.equal(shouldExposeMemoryNode({ sensitivity: 'confidential' }), false);
    assert.equal(shouldExposeMemoryNode({ sensitivity: 'confidential' }, { includeSensitive: true }), true);
  });

  it('assemble un contexte de rappel borné', () => {
    const result = assembleRecallContext({
      intent: 'relance',
      snapshot: {
        summary: 'Projet café en étude de marché.',
        keyFacts: ['Budget 15k', 'Lyon'],
        activeBlockers: ['Local introuvable'],
        nextActions: ['Contacter notaire'],
      },
      nodes: [
        {
          id: 'a',
          nodeType: 'task_state',
          content: 'Interview concurrent terminée',
          importance: 0.8,
        },
        {
          id: 'b',
          nodeType: 'risk',
          content: 'Risque de budget trop serré',
          importance: 0.6,
        },
        {
          id: 'c',
          nodeType: 'fact',
          content: 'Email personnel du porteur',
          importance: 0.9,
          sensitivity: 'personal',
        },
      ],
      edges: [
        {
          sourceNodeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          targetNodeId: '11111111-2222-3333-4444-555555555555',
          relationType: 'blocks',
          weight: 0.7,
        },
      ],
      maxChars: 200,
    });

    assert.equal(result.hasSnapshot, true);
    assert.equal(result.nodeCount, 2);
    assert.ok(!result.text.includes('Email personnel'));
    assert.ok(result.text.includes('Intent: relance'));
    assert.ok(result.charCount <= 200);
    assert.equal(result.truncated, true);
  });

  it('assemble sans tronquer si sous la limite', () => {
    const result = assembleRecallContext({
      snapshot: { summary: 'OK' },
      nodes: [],
      edges: [],
      maxChars: 4000,
    });
    assert.equal(result.truncated, false);
    assert.ok(result.text.includes('OK'));
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeFranceImplantation, FRANCE_METRO_REGIONS } from '../src/constants/franceRegions.js';

describe('carte implantation France', () => {
  it('complète les 13 régions même si l’IA en omet', () => {
    const out = normalizeFranceImplantation({
      summary: 'Lecture',
      regions: [{ code: '84', score: 88, rationale: 'Marché dense', cityHint: 'Lyon' }],
    });
    assert.equal(out.regions.length, FRANCE_METRO_REGIONS.length);
    const ara = out.regions.find((r) => r.code === '84');
    assert.equal(ara.score, 88);
    assert.equal(ara.cities.length, 1);
    assert.equal(ara.cities[0].name, 'Lyon');
    const idf = out.regions.find((r) => r.code === '11');
    assert.equal(idf.score, 50);
  });

  it('borne le score et mappe le nom de région', () => {
    const out = normalizeFranceImplantation({
      regions: [{ name: 'bretagne', feasibility: 140, rationale: 'ok' }],
    });
    const bre = out.regions.find((r) => r.code === '53');
    assert.equal(bre.score, 100);
  });

  it('classe 5 villes distinctes de la plus à la moins pertinente', () => {
    const out = normalizeFranceImplantation({
      regions: [
        {
          code: '84',
          score: 80,
          cities: [
            { name: 'Saint-Étienne', score: 60 },
            { name: 'Lyon', score: 95 },
            { name: 'Lyon', score: 90 },
            { name: 'Grenoble', score: 82 },
            { name: 'Annecy', score: 70 },
            { name: 'Clermont-Ferrand', score: 65 },
            { name: 'Valence', score: 55 },
          ],
        },
      ],
    });
    const ara = out.regions.find((r) => r.code === '84');
    assert.equal(ara.cities.length, 5);
    assert.deepEqual(
      ara.cities.map((c) => c.name),
      ['Lyon', 'Grenoble', 'Annecy', 'Clermont-Ferrand', 'Saint-Étienne']
    );
    assert.ok(ara.cities[0].score >= ara.cities[4].score);
  });
});

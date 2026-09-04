import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectService } from '../src/services/ProjectService.js';

function createService() {
  return createProjectService({
    projectRepository: {},
    activityRepository: {},
    locationRepository: {},
    aiService: {},
    currencyService: {},
  });
}

test('suggestLocations ignore les recherches trop courtes', async () => {
  const previousFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true, json: async () => [] };
  };

  try {
    const service = createService();
    const locations = await service.suggestLocations({ q: 'L' });

    assert.deepEqual(locations, []);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('suggestLocations retourne des lieux existants normalisés', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        display_name: 'Lyon, Rhône, Auvergne-Rhône-Alpes, France',
        lat: '45.7578',
        lon: '4.8320',
        address: {
          city: 'Lyon',
          state: 'Auvergne-Rhône-Alpes',
          country: 'France',
        },
      },
    ],
  });

  try {
    const service = createService();
    const locations = await service.suggestLocations({ q: 'Lyon' });

    assert.equal(locations.length, 1);
    assert.equal(locations[0].label, 'Lyon, Auvergne-Rhône-Alpes, France');
    assert.equal(locations[0].latitude, 45.7578);
    assert.equal(locations[0].longitude, 4.832);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('suggestLocations inclut le quartier dans le libellé', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        display_name: 'Part-Dieu, Lyon 3e Arrondissement, Lyon, France',
        lat: '45.7606',
        lon: '4.8495',
        address: {
          suburb: 'Part-Dieu',
          city: 'Lyon',
          state: 'Auvergne-Rhône-Alpes',
          country: 'France',
        },
      },
    ],
  });

  try {
    const service = createService();
    const locations = await service.suggestLocations({ q: 'Part-Dieu' });

    assert.equal(locations.length, 1);
    assert.match(locations[0].label, /Part-Dieu/);
    assert.match(locations[0].label, /Lyon/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('suggestLocations retente sans filtre pays si aucun résultat', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const hasCountry = String(url).includes('countrycodes=fr');
    return {
      ok: true,
      json: async () => (hasCountry && calls.length === 1
        ? []
        : [
            {
              display_name: 'Genève, Suisse',
              lat: '46.2044',
              lon: '6.1432',
              address: { city: 'Genève', country: 'Suisse' },
            },
          ]),
    };
  };

  try {
    const service = createService();
    const locations = await service.suggestLocations({ q: 'Genève', countrycodes: 'fr' });

    assert.equal(locations.length, 1);
    assert.equal(calls.length, 2);
    assert.doesNotMatch(calls[1], /countrycodes=/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('suggestLocations passe countrycodes à Nominatim', async () => {
  const previousFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return {
      ok: true,
      json: async () => [
        {
          display_name: 'Nantes, France',
          lat: '47.218',
          lon: '-1.554',
          address: { city: 'Nantes', country: 'France' },
        },
      ],
    };
  };

  try {
    const service = createService();
    await service.suggestLocations({ q: 'Nantes', countrycodes: 'fr' });
    assert.match(calledUrl, /countrycodes=fr/);
    assert.match(calledUrl, /q=Nantes/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

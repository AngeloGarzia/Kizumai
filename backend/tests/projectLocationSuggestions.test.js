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
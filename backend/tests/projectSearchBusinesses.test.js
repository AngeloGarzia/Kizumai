import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectService } from '../src/services/ProjectService.js';
import { AppError } from '../src/utils/AppError.js';

function createService({ onSearchBusinesses, projectSuggestionsCount = 3 } = {}) {
  return createProjectService({
    projectRepository: {},
    activityRepository: {},
    locationRepository: {},
    currencyService: {
      async getCurrencyData() {},
      async clampBudget(budget) {
        return budget;
      },
    },
    aiService: {
      async searchBusinesses(payload) {
        onSearchBusinesses?.(payload);
        return [
          {
            title: 'Concept local',
            activity: 'Service de proximité',
            pitch: 'Un business adapté au contexte fourni.',
          },
        ];
      },
    },
    settingsService: {
      async getBusinessConfig() {
        return { projectSuggestionsCount };
      },
    },
  });
}

test('searchBusinesses accepte un lieu sans idée', async () => {
  let payload;
  const service = createService({
    onSearchBusinesses(nextPayload) {
      payload = nextPayload;
    },
  });

  const businesses = await service.searchBusinesses({
    quoi: '',
    ou: 'Lyon',
    budget: 500,
    currency: 'EUR',
  });

  assert.equal(businesses.length, 1);
  assert.equal(payload.quoi, '');
  assert.equal(payload.ou, 'Lyon');
});

test('searchBusinesses refuse une recherche sans idée ni lieu', async () => {
  const service = createService();

  await assert.rejects(
    () => service.searchBusinesses({ quoi: '  ', ou: '  ', budget: 500, currency: 'EUR' }),
    (error) => error instanceof AppError && error.statusCode === 400
  );
});

test('searchBusinesses transmet le nombre de projets configuré en base', async () => {
  let payload;
  const service = createService({
    projectSuggestionsCount: 5,
    onSearchBusinesses(nextPayload) {
      payload = nextPayload;
    },
  });

  await service.searchBusinesses({ quoi: 'sport', ou: 'Nantes', budget: 1000, currency: 'EUR' });

  assert.equal(payload.count, 5);
});
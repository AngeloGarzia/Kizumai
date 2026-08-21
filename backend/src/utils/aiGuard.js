import { AppError } from './AppError.js';
import { config } from '../config/index.js';

/**
 * Garde-fous IA : concurrence, circuit breaker, budget journalier approximatif.
 */

const state = {
  inFlight: 0,
  failures: 0,
  openUntil: 0,
  dayKey: '',
  dayCalls: 0,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function refreshDay() {
  const k = todayKey();
  if (state.dayKey !== k) {
    state.dayKey = k;
    state.dayCalls = 0;
  }
}

export function getAiGuardLimits() {
  return {
    maxConcurrent: Number(process.env.AI_MAX_CONCURRENT) || 8,
    maxDailyCalls: Number(process.env.AI_MAX_DAILY_CALLS) || 2000,
    circuitFailThreshold: Number(process.env.AI_CIRCUIT_FAILS) || 12,
    circuitOpenMs: Number(process.env.AI_CIRCUIT_OPEN_MS) || 60_000,
    maxOutputChars: Number(process.env.AI_MAX_OUTPUT_CHARS) || 80_000,
  };
}

export async function withAiGuard(fn) {
  const limits = getAiGuardLimits();
  refreshDay();

  if (Date.now() < state.openUntil) {
    throw new AppError('Service IA temporairement indisponible (circuit ouvert)', 503);
  }
  if (state.dayCalls >= limits.maxDailyCalls) {
    throw new AppError('Quota IA journalier atteint', 429);
  }
  if (state.inFlight >= limits.maxConcurrent) {
    throw new AppError('Trop d’appels IA simultanés, réessayez', 429);
  }

  state.inFlight += 1;
  state.dayCalls += 1;
  try {
    const result = await fn();
    state.failures = Math.max(0, state.failures - 1);
    return result;
  } catch (err) {
    state.failures += 1;
    if (state.failures >= limits.circuitFailThreshold) {
      state.openUntil = Date.now() + limits.circuitOpenMs;
      state.failures = 0;
      console.warn('[ai] circuit breaker ouvert');
    }
    throw err;
  } finally {
    state.inFlight = Math.max(0, state.inFlight - 1);
  }
}

export function clipAiOutput(text, max = getAiGuardLimits().maxOutputChars) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max) : s;
}

/** Reset pour tests. */
export function _resetAiGuardForTests() {
  state.inFlight = 0;
  state.failures = 0;
  state.openUntil = 0;
  state.dayKey = '';
  state.dayCalls = 0;
}

void config;

import { AppError } from '../utils/AppError.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Rejette les clés de pollution de prototype. */
export function isDangerousKey(key) {
  return DANGEROUS_KEYS.has(String(key));
}

/** Objet plain sans proto dangereuse (copie shallow des clés sûres). */
export function safePlainObject(value, { maxKeys = 50 } = {}) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('Objet JSON attendu', 400);
  }
  const out = Object.create(null);
  let n = 0;
  for (const [key, val] of Object.entries(value)) {
    if (isDangerousKey(key)) continue;
    if (n >= maxKeys) break;
    out[key] = val;
    n += 1;
  }
  return out;
}

/** Garde uniquement les clés autorisées (ignore __proto__). */
export function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return out;
  for (const key of keys) {
    if (isDangerousKey(key)) continue;
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function omit(source, keys) {
  const blocked = new Set([...keys, ...DANGEROUS_KEYS]);
  const out = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return out;
  for (const [key, value] of Object.entries(source)) {
    if (!blocked.has(key) && !isDangerousKey(key)) out[key] = value;
  }
  return out;
}

export function requireString(value, field, { min = 1, max = 10_000 } = {}) {
  const s = value == null ? '' : String(value).trim();
  if (s.length < min || s.length > max) {
    throw new AppError(`Champ invalide : ${field}`, 400);
  }
  return s;
}

export function optionalString(value, { max = 10_000 } = {}) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function optionalNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw new AppError('Nombre invalide', 400);
  return n;
}

export function clampInt(value, { min = 0, max = 1_000_000, fallback = min } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function parseId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(`${field} invalide.`, 400);
  }
  return n;
}

export function optionalId(value, field = 'id') {
  if (value == null || value === '') return null;
  return parseId(value, field);
}

export function optionalStringArray(value, { maxItems = 20, maxItemLen = 200 } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new AppError('Tableau attendu', 400);
  return value
    .slice(0, maxItems)
    .map((item) => optionalString(item, { max: maxItemLen }) || '')
    .filter(Boolean);
}

export function optionalIdArray(value, { maxItems = 100 } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new AppError('Tableau d’identifiants attendu', 400);
  return value.slice(0, maxItems).map((v, i) => parseId(v, `id[${i}]`));
}

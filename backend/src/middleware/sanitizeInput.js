/**
 * Middleware anti pollution de prototype / HPP basique sur body JSON.
 */
export function sanitizeRequestObjects(req, _res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = scrub(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = scrub(req.query);
    }
  } catch {
    // ignore
  }
  next();
}

function scrub(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((v) => scrub(v, depth + 1));
  }
  if (typeof value !== 'object') return value;
  const out = Object.create(null);
  for (const [k, v] of Object.entries(value)) {
    if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
    out[k] = scrub(v, depth + 1);
  }
  return out;
}

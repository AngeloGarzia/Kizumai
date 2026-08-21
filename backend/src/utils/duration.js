/**
 * Parse une durée type "15m", "7d", "3600s" en millisecondes.
 * @returns {number|null}
 */
export function parseDurationMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.floor(value) : null;
  }

  const raw = String(value).trim();
  const match = /^(\d+)\s*([smhd])$/i.exec(raw);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * mult;
}

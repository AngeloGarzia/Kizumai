/**
 * Pastille rentabilité : score 0 (fragile) → 100 (solide).
 * Couleur : taupe → or → vert (haut = bon).
 */

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function mixRgb(a, b, t) {
  const k = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

const STOP_TAUPE = [166, 93, 78];
const STOP_GOLD = [196, 150, 40];
const STOP_GREEN = [34, 140, 78];

export function profitabilityRgb(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Math.min(100, Math.max(0, Number(score))) / 100;
  if (s <= 0.5) return mixRgb(STOP_TAUPE, STOP_GOLD, s / 0.5);
  return mixRgb(STOP_GOLD, STOP_GREEN, (s - 0.5) / 0.5);
}

export function profitabilityRoundPillStyle(score) {
  const rgb = profitabilityRgb(score);
  if (!rgb) {
    return {
      backgroundColor: 'rgb(243 240 237)',
      color: 'rgb(100 90 85)',
      borderColor: 'rgb(220 214 208)',
    };
  }
  const [r, g, b] = rgb;
  const textR = Math.max(28, Math.round(r * 0.42));
  const textG = Math.max(24, Math.round(g * 0.42));
  const textB = Math.max(18, Math.round(b * 0.42));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
    color: `rgb(${textR}, ${textG}, ${textB})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.9)`,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.3)`,
  };
}

export const PROFITABILITY_SEGMENT_COUNT = 6;

export function profitabilitySegments(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Math.min(100, Math.max(0, Number(score)));
  if (s <= 0) return 0;
  return Math.min(
    PROFITABILITY_SEGMENT_COUNT,
    Math.max(1, Math.round((s / 100) * PROFITABILITY_SEGMENT_COUNT))
  );
}

export function profitabilitySegmentFillColor(score) {
  const rgb = profitabilityRgb(score);
  if (!rgb) return 'rgb(200 194 188)';
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Normalise business (API) ou snapshot metadata (`score`/`label`/…). */
export function normalizeProfitability(input) {
  if (!input || typeof input !== 'object') return null;
  const score =
    input.profitabilityScore != null
      ? Number(input.profitabilityScore)
      : input.score != null
        ? Number(input.score)
        : null;
  const label = input.profitabilityLabel || input.label || null;
  const note = input.profitabilityNote || input.note || null;
  if (score == null && !label && !note) return null;
  return {
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null,
    label: label ? String(label).slice(0, 40) : null,
    note: note ? String(note).slice(0, 280) : null,
  };
}

export function profitabilityDisplayLabel(input) {
  const p = normalizeProfitability(input);
  if (!p) return 'n/d';
  if (p.label) return p.label;
  const score = p.score;
  if (score == null) return 'n/d';
  if (score <= 24) return 'Fragile';
  if (score <= 49) return 'Limitée';
  if (score <= 74) return 'Plausible';
  return 'Solide';
}

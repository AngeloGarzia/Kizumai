/**
 * Pastille concurrence : score 0 (faible, vert) → 100 (forte, marron).
 */

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/** Interpolation linéaire RGB. */
function mixRgb(a, b, t) {
  const k = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

// Vert wasabi → ambre → marron terre
const STOP_GREEN = [34, 140, 78];
const STOP_AMBER = [196, 140, 40];
const STOP_BROWN = [110, 64, 32];

export function competitionRgb(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Math.min(100, Math.max(0, Number(score))) / 100;
  if (s <= 0.5) return mixRgb(STOP_GREEN, STOP_AMBER, s / 0.5);
  return mixRgb(STOP_AMBER, STOP_BROWN, (s - 0.5) / 0.5);
}

export function competitionPillStyle(score) {
  const rgb = competitionRgb(score);
  if (!rgb) {
    return {
      backgroundColor: 'rgb(243 240 237)',
      color: 'rgb(100 90 85)',
      borderColor: 'rgb(220 214 208)',
    };
  }
  const [r, g, b] = rgb;
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
    color: `rgb(${Math.max(40, r - 30)}, ${Math.max(30, g - 35)}, ${Math.max(20, b - 20)})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
  };
}

/** Pastille ronde coin de carte : concurrence vert → ambre → marron (plus saturée). */
export function competitionRoundPillStyle(score) {
  const rgb = competitionRgb(score);
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

/** Normalise business (API) ou snapshot metadata (`score`/`label`/…). */
export function normalizeCompetition(input) {
  if (!input || typeof input !== 'object') return null;
  const score =
    input.competitionScore != null
      ? Number(input.competitionScore)
      : input.score != null
        ? Number(input.score)
        : null;
  const label = input.competitionLabel || input.label || null;
  const note = input.competitionNote || input.note || null;
  const source = input.competitionSource || input.source || null;
  if (score == null && !label && !note) return null;
  return {
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null,
    label: label ? String(label).slice(0, 40) : null,
    note: note ? String(note).slice(0, 280) : null,
    source: source === 'web' || source === 'estimated' ? source : null,
  };
}

export function competitionDisplayLabel(input) {
  const c = normalizeCompetition(input);
  if (!c) return 'n/d';
  if (c.label) return c.label;
  const score = c.score;
  if (score == null) return 'n/d';
  if (score <= 24) return 'Faible';
  if (score <= 49) return 'Modérée';
  if (score <= 74) return 'Forte';
  return 'Très forte';
}

/**
 * Jauge de faisabilité 0–100.
 * Rouge taupe (« Faudra cravacher ») → vert wasabi (« Projet réalisable plus facilement »).
 */
const TAUPE = { r: 166, g: 93, b: 78 }; // rouge taupe
const WASABI = { r: 143, g: 173, b: 31 }; // wasabi-500

function clamp(score) {
  const n = Math.round(Number(score));
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function mixColor(t) {
  const r = Math.round(TAUPE.r + (WASABI.r - TAUPE.r) * t);
  const g = Math.round(TAUPE.g + (WASABI.g - TAUPE.g) * t);
  const b = Math.round(TAUPE.b + (WASABI.b - TAUPE.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function feasibilityLabel(score) {
  const s = clamp(score);
  if (s == null) return 'En évaluation…';
  if (s <= 33) return 'Faudra cravacher';
  if (s <= 66) return 'Ça se joue';
  return 'Projet réalisable plus facilement';
}

export default function FeasibilityGauge({ score, compact = false }) {
  const value = clamp(score);
  const display = value ?? 0;
  const t = display / 100;
  const color = mixColor(t);
  const label = feasibilityLabel(value);
  const ready = value != null;

  return (
    <div
      className={[
        'rounded-2xl border border-prune-100 bg-white/80 backdrop-blur-sm',
        compact ? 'px-4 py-3' : 'px-5 py-4',
      ].join(' ')}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ready ? display : undefined}
      aria-label={`Faisabilité : ${ready ? `${display} % — ${label}` : 'en évaluation'}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
          Faisabilité
        </p>
        <p
          className="text-sm font-bold tabular-nums"
          style={{ color: ready ? color : 'var(--color-prune-400)' }}
        >
          {ready ? `${display}%` : '—'}
        </p>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-prune-100">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'linear-gradient(90deg, rgb(166,93,78) 0%, rgb(184,140,70) 50%, rgb(143,173,31) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="relative h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${ready ? display : 8}%`,
            background: ready
              ? `linear-gradient(90deg, rgb(166,93,78), ${color})`
              : 'var(--color-prune-200)',
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#a65d4e]">Faudra cravacher</span>
        <span
          className={[
            'text-xs font-semibold text-center',
            compact ? 'truncate max-w-[45%]' : '',
          ].join(' ')}
          style={{ color: ready ? color : 'var(--color-prune-400)' }}
        >
          {label}
        </span>
        <span className="text-[11px] text-wasabi-600 text-right">Plus facile</span>
      </div>
    </div>
  );
}

/** Moyenne des scores disponibles (ignore null). */
export function averageFeasibility(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const scores = items
    .map((item) => clamp(item?.feasibility))
    .filter((s) => s != null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/**
 * Score parcours : pondère idée (40 %), lieu (35 %), budget (25 %)
 * selon les infos déjà connues à l'étape courante.
 */
export function computeJourneyFeasibility({
  businessScore,
  locationScore,
  budgetScore,
}) {
  const parts = [];
  if (businessScore != null) parts.push({ weight: 0.4, value: businessScore });
  if (locationScore != null) parts.push({ weight: 0.35, value: locationScore });
  if (budgetScore != null) parts.push({ weight: 0.25, value: budgetScore });
  if (!parts.length) return null;
  const weightSum = parts.reduce((sum, p) => sum + p.weight, 0);
  return Math.round(parts.reduce((sum, p) => sum + p.value * p.weight, 0) / weightSum);
}

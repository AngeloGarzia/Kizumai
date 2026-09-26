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
  return { r, g, b };
}

function mixColorCss(t) {
  const { r, g, b } = mixColor(t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Rouge ≤ 40 %, reste bien rouge jusqu’à ~70 %, puis vert marqué dès 80 %. */
function feasibilityTone(score) {
  const s = clamp(score);
  if (s == null) return null;
  if (s <= 40) return 0;
  if (s <= 70) {
    // 40 → 0, 70 → 0.14 (encore nettement rouge)
    return ((s - 40) / 30) * 0.14;
  }
  if (s < 80) {
    // 70 → 0.14, 80 → 0.32
    return 0.14 + ((s - 70) / 10) * 0.18;
  }
  // 80 → 0.32, 100 → 1
  return 0.32 + ((s - 80) / 20) * 0.68;
}

export function feasibilityLabel(score) {
  const s = clamp(score);
  if (s == null) return 'En évaluation…';
  if (s <= 33) return 'Faudra cravacher';
  if (s <= 66) return 'Ça se joue';
  return 'Projet réalisable plus facilement';
}

/** Fond / bordure teintés selon la faisabilité (rouge &lt; 40 % → vert à 100 %). */
export function feasibilityTileStyle(score) {
  const t = feasibilityTone(score);
  if (t == null) return undefined;
  const { r, g, b } = mixColor(t);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.55)`,
  };
}

export function feasibilityAccentColor(score) {
  const t = feasibilityTone(score);
  if (t == null) return undefined;
  return mixColorCss(t);
}

/** Pastille ronde coin de carte : score réussite rouge → vert (linéaire, lisible). */
export function feasibilityRoundPillStyle(score) {
  const s = clamp(score);
  if (s == null) {
    return {
      backgroundColor: 'rgb(243 240 237)',
      color: 'rgb(100 90 85)',
      borderColor: 'rgb(220 214 208)',
    };
  }
  const { r, g, b } = mixColor(s / 100);
  const textR = Math.max(28, Math.round(r * 0.45));
  const textG = Math.max(28, Math.round(g * 0.45));
  const textB = Math.max(20, Math.round(b * 0.45));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.42)`,
    color: `rgb(${textR}, ${textG}, ${textB})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.85)`,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.35)`,
  };
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

/** Lignes affichables pour expliquer le % (idée 40 % · lieu 35 % · budget 25 %). */
export function feasibilityBreakdownRows(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return [];
  const keys = [
    ['business', 'Idée / business', 40],
    ['location', 'Lieu', 35],
    ['budget', 'Budget', 25],
  ];
  return keys
    .map(([key, fallbackLabel, weightPct]) => {
      const part = breakdown[key];
      if (!part || part.score == null || Number.isNaN(Number(part.score))) return null;
      const score = clamp(part.score);
      if (score == null) return null;
      return {
        key,
        label: part.label || fallbackLabel,
        score,
        weightPct: Math.round((Number(part.weight) || weightPct / 100) * 100),
      };
    })
    .filter(Boolean);
}

export default function FeasibilityGauge({
  score,
  compact = false,
  breakdown = null,
  explanation = null,
}) {
  const value = clamp(score);
  const display = value ?? 0;
  const t = display / 100;
  const color = mixColorCss(t);
  const label = feasibilityLabel(value);
  const ready = value != null;
  const rows = !compact ? feasibilityBreakdownRows(breakdown) : [];
  const detailText = !compact && explanation ? String(explanation).trim() : '';

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
        <span className="text-xs text-[#a65d4e]">Faudra cravacher</span>
        <span
          className={[
            'text-xs font-semibold text-center',
            compact ? 'truncate max-w-[45%]' : '',
          ].join(' ')}
          style={{ color: ready ? color : 'var(--color-prune-400)' }}
        >
          {label}
        </span>
        <span className="text-xs text-wasabi-600 text-right">Plus facile</span>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 border-t border-prune-100 pt-3 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
            Détail du score
          </p>
          <p className="text-xs text-prune-500 leading-relaxed">
            Moyenne pondérée : idée 40&nbsp;% · ancrage 35&nbsp;% · budget 25&nbsp;% (seules les
            composantes connues sont prises en compte).
          </p>
          <ul className="space-y-2">
            {rows.map((row) => {
              const rowColor = mixColorCss(row.score / 100);
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-prune-800 truncate">
                        {row.label}
                      </span>
                      <span className="text-xs tabular-nums text-prune-500 shrink-0">
                        {row.score}% · poids {row.weightPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-prune-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.score}%`,
                          background: rowColor,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {detailText ? (
        <p className="mt-3 text-sm text-prune-700 leading-relaxed border-t border-prune-100 pt-3">
          {detailText}
        </p>
      ) : null}
    </div>
  );
}

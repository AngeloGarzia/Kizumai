const TEMP_MIN = 0.3;
const TEMP_MAX = 1.3;
const TEMP_STEP = 0.1;
const TEMP_DEFAULT = 0.7;

export function clampSearchTemperature(value, fallback = TEMP_DEFAULT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(TEMP_MAX, Math.max(TEMP_MIN, n));
  return Math.round(clamped * 10) / 10;
}

export function creativityZoneLabel(value) {
  const temp = clampSearchTemperature(value);
  if (temp <= 0.5) return 'Conventionnel';
  if (temp >= 1.0) return 'Audacieux';
  return 'Équilibré';
}

/**
 * Jauge créativité / température IA (0.3 → 1.3).
 * Oriente le type d’idées (consigne métier) en plus du sampling API.
 */
export default function TemperatureGauge({
  value = TEMP_DEFAULT,
  onChange,
  id = 'search-temperature',
  className = '',
}) {
  const temp = clampSearchTemperature(value);
  const pct = ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;
  const zone = creativityZoneLabel(temp);

  return (
    <div className={`rounded-xl border border-prune-200 bg-prune-50 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={id} className="text-sm font-medium text-prune-800">
          Créativité
        </label>
        <span className="text-sm font-semibold tabular-nums text-prune-900">
          {temp.toFixed(1)} · {zone}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={TEMP_MIN}
        max={TEMP_MAX}
        step={TEMP_STEP}
        value={temp}
        onChange={(e) => onChange?.(clampSearchTemperature(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-prune-600"
        style={{
          background: `linear-gradient(to right, #5a3549 0%, #8a5574 ${pct}%, #e8d5e0 ${pct}%, #e8d5e0 100%)`,
        }}
        aria-valuemin={TEMP_MIN}
        aria-valuemax={TEMP_MAX}
        aria-valuenow={temp}
        aria-label="Créativité des idées business"
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-prune-500">
        <span>Conventionnel</span>
        <span>Équilibré</span>
        <span>Audacieux</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-prune-500">
        Oriente le style des idées (sûres ↔ originales), pas seulement le hasard du modèle.
      </p>
    </div>
  );
}

export { TEMP_MIN, TEMP_MAX, TEMP_STEP, TEMP_DEFAULT };

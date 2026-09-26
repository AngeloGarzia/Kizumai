import { useEffect, useRef, useState } from 'react';
import { projectService } from '../services/projectService.js';

const CIRCUIT_OPTIONS = [
  { value: 'markets', label: 'Marchés' },
  { value: 'events', label: 'Événements / foires' },
  { value: 'door_to_door', label: 'Porte-à-porte / tournées' },
  { value: 'other', label: 'Autre' },
];

const PERIMETER_OPTIONS = [
  { value: 'distance', label: 'Distance (km)' },
  { value: 'travel_time', label: 'Temps de trajet' },
  { value: 'admin', label: 'Région / département / ville' },
];

/**
 * Panel mobilité : point de référence + périmètre (km, temps ou découpage admin).
 */
export default function MobilitySetupPanel({
  businessTitle,
  initial = null,
  onSubmit,
  disabled = false,
}) {
  const [referenceLabel, setReferenceLabel] = useState(initial?.referenceLabel || '');
  const [perimeterType, setPerimeterType] = useState(initial?.perimeterType || 'distance');
  const [radiusKm, setRadiusKm] = useState(initial?.radiusKm ?? 50);
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(initial?.maxTravelMinutes ?? 45);
  const [adminLabel, setAdminLabel] = useState(initial?.adminLabel || '');
  const [circuitType, setCircuitType] = useState(initial?.circuitType || 'markets');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const query = referenceLabel.trim();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (query.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return undefined;
    }
    setLoadingSuggest(true);
    const timer = setTimeout(async () => {
      try {
        const list = await projectService.suggestLocations(query);
        if (requestRef.current === requestId) setSuggestions(list);
      } catch {
        if (requestRef.current === requestId) setSuggestions([]);
      } finally {
        if (requestRef.current === requestId) setLoadingSuggest(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [referenceLabel]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const ref = referenceLabel.trim();
    if (!ref) {
      setError('Indiquez un point de référence géographique (base, domicile, garage…).');
      return;
    }
    if (perimeterType === 'distance' && !(Number(radiusKm) > 0)) {
      setError('Indiquez un rayon de travail en kilomètres.');
      return;
    }
    if (perimeterType === 'travel_time' && !(Number(maxTravelMinutes) > 0)) {
      setError('Indiquez un temps de trajet maximum en minutes.');
      return;
    }
    if (perimeterType === 'admin' && !adminLabel.trim()) {
      setError('Précisez la ou les zones (région, département, ville…).');
      return;
    }
    setError('');
    onSubmit({
      referenceLabel: ref,
      perimeterType,
      radiusKm: perimeterType === 'distance' ? Number(radiusKm) : null,
      maxTravelMinutes: perimeterType === 'travel_time' ? Number(maxTravelMinutes) : null,
      adminLabel: perimeterType === 'admin' ? adminLabel.trim() : null,
      circuitType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-wasabi-200 bg-white p-5 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-wasabi-700">Mobilité</p>
        <h2 className="text-lg font-bold text-prune-900 mt-1">
          Zone d’opération pour « {businessTitle} »
        </h2>
        <p className="text-sm text-prune-500 mt-1">
          Point de référence + rayon de travail (distance, temps ou découpage administratif).
        </p>
      </div>

      {error && <p className="alert-error text-sm">{error}</p>}

      <div className="relative">
        <label htmlFor="mobility-ref" className="block text-sm font-medium text-prune-800 mb-1">
          Point de référence
        </label>
        <input
          id="mobility-ref"
          type="text"
          className="input-field w-full"
          placeholder="Ex : Lyon Part-Dieu, garage à Clermont…"
          value={referenceLabel}
          onChange={(e) => setReferenceLabel(e.target.value)}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
          disabled={disabled}
          autoComplete="off"
        />
        {showSuggest && referenceLabel.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-prune-100 bg-white shadow-lg">
            {loadingSuggest && <p className="px-4 py-3 text-sm text-prune-500">Recherche…</p>}
            {!loadingSuggest &&
              suggestions.map((loc) => (
                <button
                  key={`${loc.label}-${loc.latitude}-${loc.longitude}`}
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-wasabi-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setReferenceLabel(loc.label);
                    setShowSuggest(false);
                  }}
                >
                  {loc.label}
                </button>
              ))}
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Type de circuit</legend>
        <div className="flex flex-wrap gap-2">
          {CIRCUIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setCircuitType(opt.value)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                circuitType === opt.value
                  ? 'border-wasabi-500 bg-wasabi-100 text-wasabi-900'
                  : 'border-prune-100 text-prune-600 hover:border-prune-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Périmètre de travail</legend>
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIMETER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setPerimeterType(opt.value)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                perimeterType === opt.value
                  ? 'border-wasabi-500 bg-wasabi-100 text-wasabi-900'
                  : 'border-prune-100 text-prune-600 hover:border-prune-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {perimeterType === 'distance' && (
          <div>
            <label htmlFor="mobility-km" className="block text-xs text-prune-500 mb-1">
              Rayon (km)
            </label>
            <input
              id="mobility-km"
              type="number"
              min={1}
              max={500}
              className="input-field w-full sm:w-40"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
        {perimeterType === 'travel_time' && (
          <div>
            <label htmlFor="mobility-min" className="block text-xs text-prune-500 mb-1">
              Temps max (minutes)
            </label>
            <input
              id="mobility-min"
              type="number"
              min={5}
              max={300}
              className="input-field w-full sm:w-40"
              value={maxTravelMinutes}
              onChange={(e) => setMaxTravelMinutes(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
        {perimeterType === 'admin' && (
          <div>
            <label htmlFor="mobility-admin" className="block text-xs text-prune-500 mb-1">
              Zones (région, département, ville…)
            </label>
            <input
              id="mobility-admin"
              type="text"
              className="input-field w-full"
              placeholder="Ex : Auvergne-Rhône-Alpes, Puy-de-Dôme, Clermont…"
              value={adminLabel}
              onChange={(e) => setAdminLabel(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
      </fieldset>

      <button type="submit" disabled={disabled} className="btn-primary w-full sm:w-auto disabled:opacity-50">
        Continuer vers le budget
      </button>
    </form>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { projectService } from '../services/projectService.js';
import FabulousThinking from './FabulousThinking.jsx';
import { assistantPhrases } from '../constants/assistant.js';

const PERIMETER_OPTIONS = [
  { value: 'distance', label: 'Distance (km)' },
  { value: 'travel_time', label: 'Temps de trajet' },
  { value: 'admin', label: 'Région / département / ville' },
];

/**
 * Panel mobilité : point de référence + périmètre + type de circuit (proposé par Fabulous).
 */
export default function MobilitySetupPanel({
  businessTitle,
  business = null,
  seed = null,
  initial = null,
  onSubmit,
  disabled = false,
}) {
  const [referenceLabel, setReferenceLabel] = useState(initial?.referenceLabel || '');
  const [perimeterType, setPerimeterType] = useState(initial?.perimeterType || 'distance');
  const [radiusKm, setRadiusKm] = useState(initial?.radiusKm ?? 50);
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(initial?.maxTravelMinutes ?? 45);
  const [adminLabel, setAdminLabel] = useState(initial?.adminLabel || '');
  const [circuitType, setCircuitType] = useState(initial?.circuitType || '');
  const [circuitLabel, setCircuitLabel] = useState(initial?.circuitLabel || '');
  const [circuits, setCircuits] = useState(
    Array.isArray(initial?.circuitOptions) ? initial.circuitOptions : []
  );
  const [circuitsLoading, setCircuitsLoading] = useState(false);
  const [circuitsError, setCircuitsError] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const requestRef = useRef(0);
  const circuitsRequestRef = useRef(0);
  const businessKey = [
    business?.title || businessTitle || '',
    business?.activity || '',
  ].join('|');

  const loadCircuits = useCallback(async () => {
    const title = String(business?.title || businessTitle || '').trim();
    if (!title) {
      setCircuits([]);
      setCircuitsError('Business manquant pour proposer des circuits.');
      return;
    }
    const requestId = circuitsRequestRef.current + 1;
    circuitsRequestRef.current = requestId;
    setCircuitsLoading(true);
    setCircuitsError('');
    try {
      const list = await projectService.searchMobilityCircuits({
        business: title,
        businessActivity: business?.activity || '',
        businessPitch: business?.pitch || '',
        businessRationale: business?.rationale || '',
        ou: seed?.ou || '',
        budget: seed?.budget,
        currency: seed?.currency || 'EUR',
        temperature: seed?.temperature,
      });
      if (circuitsRequestRef.current !== requestId) return;
      setCircuits(Array.isArray(list) ? list : []);
      if (!Array.isArray(list) || !list.length) {
        setCircuitsError('Aucun circuit proposé. Réessayez.');
        return;
      }
      setCircuitType((prevId) => {
        const match = list.find((c) => c.id === prevId);
        if (match) {
          setCircuitLabel(match.label);
          return prevId;
        }
        setCircuitLabel(list[0].label);
        return list[0].id;
      });
    } catch (err) {
      if (circuitsRequestRef.current !== requestId) return;
      setCircuits([]);
      setCircuitsError(err.message || 'Impossible de charger les types de circuit.');
    } finally {
      if (circuitsRequestRef.current === requestId) setCircuitsLoading(false);
    }
  }, [
    business?.activity,
    business?.pitch,
    business?.rationale,
    business?.title,
    businessTitle,
    seed?.budget,
    seed?.currency,
    seed?.ou,
    seed?.temperature,
  ]);

  useEffect(() => {
    if (Array.isArray(initial?.circuitOptions) && initial.circuitOptions.length) {
      setCircuits(initial.circuitOptions);
      return;
    }
    loadCircuits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessKey]);

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
    if (!circuitType || !circuitLabel) {
      setError('Choisissez un type de circuit proposé par Fabulous.');
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
      circuitLabel,
      circuitOptions: circuits,
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
        <legend className="text-sm font-medium text-prune-800 mb-1">Type de circuit</legend>
        <p className="text-xs text-prune-500 mb-2">
          Propositions Fabulous adaptées à « {businessTitle} » (~10 options).
        </p>
        {circuitsLoading && (
          <FabulousThinking message={assistantPhrases.thinking} size="sm" compact />
        )}
        {!circuitsLoading && circuitsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
            <p className="text-sm text-amber-900">{circuitsError}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={loadCircuits}
              className="text-sm font-semibold text-wasabi-700 hover:text-wasabi-600"
            >
              Réessayer
            </button>
          </div>
        )}
        {!circuitsLoading && !circuitsError && circuits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {circuits.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                title={opt.angle || opt.label}
                onClick={() => {
                  setCircuitType(opt.id);
                  setCircuitLabel(opt.label);
                }}
                className={[
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors text-left max-w-full',
                  circuitType === opt.id
                    ? 'border-wasabi-500 bg-wasabi-100 text-wasabi-900'
                    : 'border-prune-100 text-prune-600 hover:border-prune-300',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {circuitType && circuitLabel && (
          <p className="mt-2 text-xs text-prune-500">
            Sélection : <span className="font-medium text-prune-700">{circuitLabel}</span>
            {circuits.find((c) => c.id === circuitType)?.angle
              ? ` — ${circuits.find((c) => c.id === circuitType).angle}`
              : ''}
          </p>
        )}
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

      <button
        type="submit"
        disabled={disabled || circuitsLoading || !circuits.length}
        className="btn-primary w-full sm:w-auto disabled:opacity-50"
      >
        Continuer vers le budget
      </button>
    </form>
  );
}

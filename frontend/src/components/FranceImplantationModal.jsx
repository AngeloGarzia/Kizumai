import { useEffect, useRef, useState } from 'react';
import { FRANCE_REGION_PATHS } from '../data/franceRegionPaths.js';
import { projectService } from '../services/projectService.js';
import { assistantPhrases } from '../constants/assistant.js';
import FabulousThinking from './FabulousThinking.jsx';

export function scoreToFill(score) {
  const t = Math.max(0, Math.min(100, Number(score) || 0)) / 100;
  if (t < 0.5) {
    const u = t * 2;
    const r = 214;
    const g = Math.round(64 + u * 160);
    const b = Math.round(48 + u * 20);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const u = (t - 0.5) * 2;
  const r = Math.round(214 - u * 150);
  const g = Math.round(176 + u * 44);
  const b = Math.round(68 + u * 52);
  return `rgb(${r}, ${g}, ${b})`;
}

function scoreTextColor(score) {
  return Number(score) < 48 ? '#fff7f5' : '#2a1520';
}

function CityTile({ rank, city, onSelect }) {
  const bg = scoreToFill(city.score);
  const color = scoreTextColor(city.score);
  return (
    <button
      type="button"
      onClick={() => onSelect(city)}
      className="w-full text-left rounded-xl border border-black/10 hover:brightness-95 p-3 transition-[filter]"
      style={{ backgroundColor: bg, color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {rank != null && (
              <span className="opacity-70 font-bold mr-1.5">{rank}.</span>
            )}
            {city.name}
          </p>
          {city.rationale && (
            <p className="text-xs mt-1 opacity-90">{city.rationale}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums opacity-95">
          {city.score}/100
        </span>
      </div>
    </button>
  );
}

export default function FranceImplantationModal({
  business,
  loading,
  error,
  summary,
  regions,
  selectedCode,
  onSelectRegion,
  onConfirmCity,
  onEvaluateCity,
  onSkip,
  onClose,
}) {
  const selected = regions.find((r) => r.code === selectedCode) || null;
  const cities = selected?.cities || [];
  const [cityQuery, setCityQuery] = useState('');
  const [cityEval, setCityEval] = useState(null);
  const [cityBusy, setCityBusy] = useState(false);
  const [cityError, setCityError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRequestRef = useRef(0);

  useEffect(() => {
    setCityQuery('');
    setCityEval(null);
    setCityError('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [selectedCode]);

  useEffect(() => {
    const query = cityQuery.trim();
    const requestId = suggestRequestRef.current + 1;
    suggestRequestRef.current = requestId;

    if (query.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return undefined;
    }

    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const list = await projectService.suggestLocations(query, { countrycodes: 'fr' });
        if (suggestRequestRef.current === requestId) {
          setSuggestions(list);
        }
      } catch {
        if (suggestRequestRef.current === requestId) {
          setSuggestions([]);
        }
      } finally {
        if (suggestRequestRef.current === requestId) {
          setSuggestLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [cityQuery]);

  const pickSuggestion = (location) => {
    const name = location.city || String(location.label || '').split(',')[0].trim();
    setCityQuery(name);
    setSuggestions([]);
    setShowSuggestions(false);
    setCityEval(null);
    setCityError('');
  };

  const submitCityEval = async (e) => {
    e?.preventDefault?.();
    const value = cityQuery.trim();
    if (!value || !onEvaluateCity) return;
    setCityBusy(true);
    setCityError('');
    setCityEval(null);
    setShowSuggestions(false);
    try {
      const result = await onEvaluateCity({
        city: value,
        region: selected?.name || '',
      });
      setCityEval(result);
    } catch (err) {
      setCityError(err.message || 'Évaluation impossible.');
    } finally {
      setCityBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="france-map-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
              Où s&apos;implanter
            </p>
            <h2 id="france-map-title" className="text-lg font-bold text-prune-900 mt-1">
              Carte de France pour « {business?.title} »
            </h2>
            <p className="text-sm text-prune-500 mt-1">
              Vert : emplacement favorable. Rouge : implantation plus difficile
              (marché, loyers, coût de la vie, concurrence).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-prune-500 hover:bg-prune-50"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          className="h-2 rounded-full mb-4"
          style={{
            background:
              'linear-gradient(90deg, rgb(214,64,48) 0%, rgb(214,176,68) 50%, rgb(64,220,120) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="flex justify-between text-[11px] text-prune-500 mb-4">
          <span>Difficile</span>
          <span>Possible</span>
          <span>Très bon</span>
        </div>

        {error && <p className="alert-error mb-3">{error}</p>}

        {loading ? (
          <FabulousThinking message={assistantPhrases.evaluatingRegions} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.9fr)]">
            <div className="rounded-2xl border border-prune-100 bg-prune-50/40 p-2">
              <svg
                viewBox="0 0 520 560"
                className="w-full h-auto"
                role="img"
                aria-label="Carte des régions de France colorée selon l'opportunité d'implantation"
              >
                {regions.map((region) => {
                  const d = FRANCE_REGION_PATHS[region.code];
                  if (!d) return null;
                  const active = selectedCode === region.code;
                  return (
                    <path
                      key={region.code}
                      d={d}
                      fill={scoreToFill(region.score)}
                      stroke={active ? '#3d1f2b' : '#fff'}
                      strokeWidth={active ? 2.4 : 0.9}
                      className="cursor-pointer hover:opacity-90"
                      onClick={() => onSelectRegion(region)}
                    >
                      <title>
                        {region.name} — {region.score}/100
                      </title>
                    </path>
                  );
                })}
              </svg>
            </div>

            <div className="space-y-3">
              {summary && (
                <p className="text-sm text-prune-700 bg-prune-50 rounded-xl px-3 py-2">{summary}</p>
              )}

              <form onSubmit={submitCityEval} className="rounded-2xl border border-prune-200 p-3 space-y-2">
                <label htmlFor="city-eval-input" className="label-field">
                  Ville
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      id="city-eval-input"
                      type="text"
                      className="input-field w-full"
                      placeholder="Ex : Nantes, Annecy…"
                      value={cityQuery}
                      onChange={(e) => {
                        setCityQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      disabled={cityBusy}
                      maxLength={120}
                      autoComplete="off"
                    />
                    {showSuggestions && (suggestLoading || suggestions.length > 0) && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-prune-100 bg-white shadow-lg">
                        {suggestLoading && (
                          <p className="px-3 py-2 text-sm text-prune-500">Recherche de lieux…</p>
                        )}
                        {!suggestLoading &&
                          suggestions.map((location) => (
                            <button
                              key={`${location.label}-${location.latitude}-${location.longitude}`}
                              type="button"
                              className="block w-full px-3 py-2.5 text-left text-sm text-prune-800 hover:bg-prune-50"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickSuggestion(location)}
                            >
                              <span className="font-medium">
                                {location.city || location.label}
                              </span>
                              {location.displayName && (
                                <span className="mt-0.5 block truncate text-xs text-prune-500">
                                  {location.displayName}
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="btn-secondary whitespace-nowrap disabled:opacity-50 inline-flex items-center gap-2"
                    disabled={cityBusy || !cityQuery.trim()}
                  >
                    {cityBusy ? (
                      <FabulousThinking
                        compact
                        size="sm"
                        message={assistantPhrases.evaluatingCity}
                      />
                    ) : (
                      'Évaluer'
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-prune-500">
                  Suggestions via OpenStreetMap (Nominatim). Choisissez un lieu puis évaluez
                  l&apos;implantation.
                </p>
                {cityError && <p className="alert-error text-sm">{cityError}</p>}
                {cityEval && (
                  <CityTile
                    city={cityEval}
                    onSelect={(city) =>
                      onConfirmCity(selected || { name: cityEval.name, code: null }, city)
                    }
                  />
                )}
              </form>

              {selected ? (
                <div className="rounded-2xl border border-prune-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-prune-900">{selected.name}</h3>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-prune-700">
                      {selected.score}/100
                    </span>
                  </div>
                  {selected.rationale && (
                    <p className="text-sm text-prune-600">{selected.rationale}</p>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-prune-500 mb-2">
                      5 villes proposées (du plus au moins pertinent)
                    </p>
                    {cities.length === 0 ? (
                      <p className="text-sm text-prune-500">
                        Aucune ville proposée pour cette région. Évaluez une ville ci-dessus
                        ou choisissez une autre région.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {cities.map((city, index) => (
                          <li key={`${city.name}-${index}`}>
                            <CityTile
                              rank={index + 1}
                              city={city}
                              onSelect={(c) => onConfirmCity(selected, c)}
                            />
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-prune-500">
                  Cliquez une région pour voir 5 villes classées, ou évaluez directement une ville.
                </p>
              )}
              <button type="button" className="btn-secondary w-full" onClick={onSkip}>
                Continuer sans choisir de région
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import BudgetField from '../components/BudgetField.jsx';
import TemperatureGauge, {
  TEMP_DEFAULT,
  clampSearchTemperature,
} from '../components/TemperatureGauge.jsx';
import {
  clearSearchProgress,
  getSearchProgress,
  getSearchSeed,
  projectService,
  saveSearchProgress,
  saveSearchSeed,
} from '../services/projectService.js';
import { IconChevronRight } from '../components/icons.jsx';

function buildSeed({ quoi, ou, budget, currency, temperature }) {
  return {
    quoi: quoi.trim() || null,
    ou: ou.trim() || null,
    budget: budget != null && Number(budget) > 0 ? Number(budget) : 500,
    currency,
    temperature: clampSearchTemperature(temperature),
  };
}

function seedChanged(prev, next) {
  if (!prev) return true;
  return (
    String(prev.quoi || '') !== String(next.quoi || '') ||
    String(prev.ou || '') !== String(next.ou || '') ||
    Number(prev.budget) !== Number(next.budget) ||
    String(prev.currency || '') !== String(next.currency || '') ||
    Number(prev.temperature) !== Number(next.temperature)
  );
}

export default function CreateFuture() {
  const navigate = useNavigate();

  const [quoi, setQuoi] = useState('');
  const [ou, setOu] = useState('');
  const [budget, setBudget] = useState(null);
  const [currency, setCurrency] = useState('EUR');
  const [temperature, setTemperature] = useState(TEMP_DEFAULT);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [resumeStep, setResumeStep] = useState(null);
  const locationRequestRef = useRef(0);

  const hasQuoi = Boolean(quoi.trim());
  const hasOu = Boolean(ou.trim());
  const canLaunch = hasQuoi || hasOu;
  const canResume = Boolean(resumeStep);

  useEffect(() => {
    const seed = getSearchSeed();
    const progress = getSearchProgress();
    if (seed) {
      setQuoi(seed.quoi || '');
      setOu(seed.ou || '');
      setBudget(seed.budget != null ? seed.budget : null);
      setCurrency(seed.currency || 'EUR');
      if (seed.temperature != null) setTemperature(clampSearchTemperature(seed.temperature));
    }
    if (progress?.businesses?.length) {
      setResumeStep(progress.step || 'businesses');
    } else {
      setResumeStep(null);
    }
  }, []);

  useEffect(() => {
    const query = ou.trim();
    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      setLocationError('');
      return undefined;
    }

    setLocationLoading(true);
    setLocationError('');
    const timer = setTimeout(async () => {
      try {
        const suggestions = await projectService.suggestLocations(query);
        if (locationRequestRef.current === requestId) {
          setLocationSuggestions(suggestions);
        }
      } catch {
        if (locationRequestRef.current === requestId) {
          setLocationSuggestions([]);
          setLocationError('Suggestions indisponibles. Vous pouvez saisir le lieu manuellement.');
        }
      } finally {
        if (locationRequestRef.current === requestId) {
          setLocationLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [ou]);

  const resumeSearch = () => {
    const progress = getSearchProgress();
    const nextSeed = buildSeed({ quoi, ou, budget, currency, temperature });
    const prevSeed = progress?.seed || getSearchSeed();
    saveSearchSeed(nextSeed);

    // Critères modifiés → on garde la session mais on repart sur l'étape Business.
    if (seedChanged(prevSeed, nextSeed)) {
      saveSearchProgress({
        ...(progress || {}),
        seed: nextSeed,
        step: 'businesses',
        businesses: [],
        selectedBusiness: null,
        locations: [],
        selectedLocation: null,
        proposals: [],
        budgetAssessment: null,
      });
      navigate('/projet/recherche?step=businesses');
      return;
    }

    const step = progress?.step || resumeStep || 'businesses';
    if (progress) {
      saveSearchProgress({ ...progress, seed: nextSeed });
    }
    navigate(`/projet/recherche?step=${step}`);
  };

  const startFreshSearch = () => {
    setError('');
    if (!canLaunch) {
      setError('Indiquez au moins une idée ou un lieu pour lancer la recherche.');
      return;
    }
    setSubmitting(true);
    clearSearchProgress();
    saveSearchSeed(buildSeed({ quoi, ou, budget, currency, temperature }));
    navigate('/projet/recherche?step=businesses');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canResume) resumeSearch();
    else startFreshSearch();
  };

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 flex items-center justify-center gap-3">
          <BrandLogo size="sm" />
        </div>
      </header>

      <main className="page-container flex-1 py-6 sm:py-10 max-w-[50.4rem]">
        <section className="mb-6 sm:mb-8">
          <div className="rounded-2xl px-5 py-6 sm:px-8 sm:py-7 text-center sm:text-left bg-gradient-to-r from-topaz-500 to-topaz-400 shadow-md shadow-topaz-500/25">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Ici commence ton futur
            </h1>
          </div>
        </section>

        {canResume && (
          <div className="mb-4 rounded-2xl border border-wasabi-200 bg-wasabi-50 px-4 py-3 text-sm text-prune-800">
            Une recherche est en cours. Tu peux la reprendre ou modifier les critères puis continuer.
          </div>
        )}

        <div className="card p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="quoi"
              label="Une idée, une envie ?"
              value={quoi}
              onChange={(e) => setQuoi(e.target.value)}
              placeholder="Ex : Boutique de produits locaux bio"
            />

            <div className="relative">
              <Input
                id="ou"
                label="Où ?"
                value={ou}
                onChange={(e) => {
                  setOu(e.target.value);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 120)}
                placeholder="Ex : Lyon, quartier Part-Dieu"
                autoComplete="off"
              />
              {showLocationSuggestions && ou.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-prune-100 bg-white shadow-lg">
                  {locationLoading && (
                    <p className="px-4 py-3 text-sm text-prune-500">Recherche de lieux…</p>
                  )}
                  {!locationLoading && locationError && (
                    <p className="px-4 py-3 text-sm text-amber-700">{locationError}</p>
                  )}
                  {!locationLoading && !locationError && locationSuggestions.length === 0 && (
                    <p className="px-4 py-3 text-sm text-prune-500">
                      Aucun lieu trouvé pour « {ou.trim()} ». Vous pouvez continuer avec cette saisie.
                    </p>
                  )}
                  {!locationLoading && locationSuggestions.map((location) => (
                    <button
                      key={`${location.label}-${location.latitude}-${location.longitude}`}
                      type="button"
                      className="block w-full px-4 py-3 text-left text-sm text-prune-800 hover:bg-prune-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setOu(location.label);
                        setShowLocationSuggestions(false);
                      }}
                    >
                      <span className="font-medium">{location.label}</span>
                      {location.displayName && location.displayName !== location.label && (
                        <span className="mt-0.5 block truncate text-xs text-prune-500">
                          {location.displayName}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <BudgetField
              budget={budget}
              onBudgetChange={setBudget}
              currency={currency}
              onCurrencyChange={setCurrency}
            />

            <TemperatureGauge value={temperature} onChange={setTemperature} />

            {error && <p className="alert-error">{error}</p>}

            <Button type="submit" disabled={submitting || !canLaunch}>
              {submitting
                ? 'Recherche en cours...'
                : canResume
                  ? 'Continuer la recherche'
                  : 'Lancer la recherche'}
            </Button>

            {canResume && (
              <button
                type="button"
                onClick={startFreshSearch}
                disabled={submitting || !canLaunch}
                className="w-full text-sm font-medium text-prune-600 hover:text-prune-900 underline underline-offset-2 disabled:opacity-50"
              >
                Relancer une nouvelle recherche
              </button>
            )}
          </form>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 w-full flex items-center justify-center gap-1 text-sm text-prune-500 hover:text-prune-700"
        >
          Retour à l&apos;accueil
          <IconChevronRight className="w-4 h-4 rotate-180" />
        </button>
      </main>
    </div>
  );
}

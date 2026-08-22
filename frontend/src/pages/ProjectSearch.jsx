import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import FeasibilityGauge, {
  averageFeasibility,
  computeJourneyFeasibility,
} from '../components/FeasibilityGauge.jsx';
import {
  projectService,
  getSearchSeed,
  clearSearchSeed,
  saveProjectDraft,
} from '../services/projectService.js';
import { IconChevronRight } from '../components/icons.jsx';

const STEPS = [
  { key: 'businesses', label: 'Business' },
  { key: 'locations', label: 'Lieu' },
  { key: 'proposals', label: 'Projet' },
];

function formatBudget(amount, currency) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function Stepper({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, index) => {
        const state =
          index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo';
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                  state === 'active'
                    ? 'bg-prune-600 text-white'
                    : state === 'done'
                      ? 'bg-wasabi-500 text-white'
                      : 'bg-prune-100 text-prune-500',
                ].join(' ')}
              >
                {index + 1}
              </span>
              <span
                className={[
                  'text-xs sm:text-sm font-medium',
                  state === 'todo' ? 'text-prune-400' : 'text-prune-800',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span className="w-6 sm:w-10 h-px bg-prune-200" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SelectableCard({ selected, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-2xl border p-5 transition-all',
        selected
          ? 'border-prune-500 ring-2 ring-prune-200 bg-prune-50/60'
          : 'border-prune-100 hover:border-prune-300 hover:shadow-sm bg-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function RefineBar({ placeholder, value, onChange, onSubmit, disabled }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col sm:flex-row gap-3"
    >
      <input
        type="text"
        className="input-field flex-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled}
        className="btn-secondary whitespace-nowrap disabled:opacity-50"
      >
        Affiner avec l&apos;IA
      </button>
    </form>
  );
}

const FORMAT_LABEL = {
  en_ligne: 'En ligne',
  presentiel: 'Présentiel',
  mixte: 'Mixte',
};

function TrainingModal({
  business,
  trainings,
  loading,
  error,
  refine,
  onRefineChange,
  onRefine,
  savedTitle,
  onSave,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
              Assistance formation
            </p>
            <h2 id="training-modal-title" className="text-lg font-bold text-prune-900 mt-1">
              Formations pour « {business.title} »
            </h2>
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

        {error && <p className="alert-error mb-3">{error}</p>}

        {loading ? (
          <p className="py-10 text-center text-sm text-prune-500">L&apos;IA prépare des formations…</p>
        ) : trainings.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-prune-500 mb-4">
            Aucune formation pour le moment. Affinez ou réessayez.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {trainings.map((training, index) => {
              const saved = savedTitle === training.title;
              return (
                <div
                  key={index}
                  className={[
                    'rounded-2xl border p-4',
                    saved ? 'border-wasabi-400 bg-wasabi-50/50' : 'border-prune-100',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-prune-900">{training.title}</h3>
                    <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-prune-100 text-prune-700">
                      {training.level}
                    </span>
                  </div>
                  <p className="text-xs text-prune-500 mt-1">
                    {training.duration || 'Durée à préciser'}
                    {' · '}
                    {FORMAT_LABEL[training.format] || training.format}
                  </p>
                  {training.rationale && (
                    <p className="text-sm text-prune-600 mt-2">{training.rationale}</p>
                  )}
                  {training.skills?.length > 0 && (
                    <p className="text-xs text-prune-500 mt-2">
                      Compétences : {training.skills.join(', ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onSave(training)}
                    className="mt-3 text-xs font-semibold text-wasabi-700 hover:underline"
                  >
                    {saved ? 'Formation mise de côté ✓' : 'Mettre de côté'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <RefineBar
          placeholder="Ex : plutôt courte, certifiante, gestion…"
          value={refine}
          onChange={onRefineChange}
          onSubmit={onRefine}
          disabled={loading}
        />

        <button type="button" onClick={onClose} className="btn-secondary w-full mt-4">
          Continuer le choix du business
        </button>
      </div>
    </div>
  );
}

export default function ProjectSearch() {
  const navigate = useNavigate();
  const seedRef = useRef(null);

  const [step, setStep] = useState('businesses');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refine, setRefine] = useState('');

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [proposals, setProposals] = useState([]);
  const [budgetAssessment, setBudgetAssessment] = useState(null);

  // Assistance formation (option A : sur chaque carte business)
  const [trainingBusiness, setTrainingBusiness] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState('');
  const [trainingRefine, setTrainingRefine] = useState('');
  const [savedTraining, setSavedTraining] = useState(null);

  const proposalKindLabel = (kind) => {
    if (kind === 'budget_ideal') return 'Budget idéal (IA)';
    if (kind === 'budget_flexible') return 'Budget flexible';
    if (kind === 'budget_ajuste') return 'Budget ajusté';
    return 'Votre budget';
  };

  const proposalKindClass = (kind) => {
    if (kind === 'budget_ideal') return 'bg-wasabi-100 text-wasabi-700';
    if (kind === 'budget_flexible') return 'bg-topaz-100 text-topaz-700';
    if (kind === 'budget_ajuste') return 'bg-amber-100 text-amber-800';
    return 'bg-prune-100 text-prune-700';
  };

  // Jauge parcours : idée / lieu / budget selon l'avancement des choix.
  const feasibilityScore = useMemo(() => {
    const businessScore =
      selectedBusiness?.feasibility ?? averageFeasibility(businesses);
    const locationScore =
      selectedLocation?.feasibility ??
      (step === 'locations' || step === 'proposals'
        ? averageFeasibility(locations)
        : null);
    const budgetScore =
      budgetAssessment?.feasibility ??
      (step === 'proposals' ? averageFeasibility(proposals) : null);

    return computeJourneyFeasibility({
      businessScore,
      locationScore,
      budgetScore,
    });
  }, [
    step,
    businesses,
    selectedBusiness,
    locations,
    selectedLocation,
    proposals,
    budgetAssessment,
  ]);

  const fetchBusinesses = useCallback(async (refineText = '', avoid = []) => {
    const seed = seedRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await projectService.searchBusinesses({
        quoi: seed.quoi,
        ou: seed.ou,
        budget: seed.budget,
        currency: seed.currency,
        refine: refineText,
        avoid,
      });
      setBusinesses(result);
    } catch (err) {
      setError(err.message || 'La recherche a échoué.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async (business, refineText = '', avoid = []) => {
    const seed = seedRef.current;
    setLoading(true);
    setError('');
    try {
      // Le lieu est toujours corrélé au business choisi + à la zone saisie (si présente).
      const result = await projectService.searchLocations({
        business: business.title,
        businessActivity: business.activity,
        businessPitch: business.pitch,
        businessRationale: business.rationale,
        ou: seed.ou || '',
        budget: seed.budget,
        currency: seed.currency,
        refine: refineText,
        avoid,
      });
      setLocations(result);
    } catch (err) {
      setError(err.message || 'La recherche a échoué.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrainings = useCallback(async (business, refineText = '', avoid = []) => {
    const seed = seedRef.current;
    setTrainingLoading(true);
    setTrainingError('');
    try {
      const result = await projectService.searchTrainings({
        business: business.title,
        businessActivity: business.activity,
        businessPitch: business.pitch,
        businessRationale: business.rationale,
        quoi: seed?.quoi || '',
        ou: seed?.ou || '',
        budget: seed?.budget,
        currency: seed?.currency,
        refine: refineText,
        avoid,
      });
      setTrainings(result);
    } catch (err) {
      setTrainingError(err.message || 'Impossible de charger les formations.');
    } finally {
      setTrainingLoading(false);
    }
  }, []);

  const openTrainingAssist = (business, event) => {
    event?.stopPropagation?.();
    setTrainingBusiness(business);
    setTrainings([]);
    setTrainingRefine('');
    setTrainingError('');
    fetchTrainings(business, '', []);
  };

  const closeTrainingAssist = () => {
    setTrainingBusiness(null);
    setTrainings([]);
    setTrainingRefine('');
    setTrainingError('');
  };

  const fetchProposals = useCallback(async (business, location, refineText = '') => {
    const seed = seedRef.current;
    setLoading(true);
    setError('');
    try {
      const locationLabel = [location.label, location.city].filter(Boolean).join(' — ');
      const result = await projectService.buildProposals({
        business: business.title,
        location: locationLabel,
        budget: seed.budget,
        currency: seed.currency,
        refine: refineText,
      });
      setProposals(result.proposals || []);
      setBudgetAssessment(result.assessment || null);
    } catch (err) {
      setError(err.message || 'La recherche a échoué.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const seed = getSearchSeed();
    if (!seed) {
      navigate('/creer-son-avenir', { replace: true });
      return;
    }
    seedRef.current = seed;
    fetchBusinesses('', []);
  }, [navigate, fetchBusinesses]);

  const handleSelectBusiness = (business) => {
    setSelectedBusiness(business);
    setSelectedLocation(null);
    setLocations([]);
    setRefine('');
    setStep('locations');
    fetchLocations(business, '', []);
  };

  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setProposals([]);
    setBudgetAssessment(null);
    setRefine('');
    setStep('proposals');
    fetchProposals(selectedBusiness, location, '');
  };

  const handleSelectProposal = (proposal) => {
    const seed = seedRef.current;
    const locationLabel = [selectedLocation.label, selectedLocation.city]
      .filter(Boolean)
      .join(' — ');

    const trainingForBusiness =
      savedTraining?.businessTitle === selectedBusiness.title ? savedTraining : null;

    saveProjectDraft({
      quoi: selectedBusiness.title,
      ou: locationLabel,
      budget: proposal.budget,
      currency: proposal.currency || seed.currency,
      source: 'ai',
      title: proposal.title,
      report: proposal.report,
      sections: proposal.sections,
      training: trainingForBusiness
        ? {
            title: trainingForBusiness.title,
            level: trainingForBusiness.level,
            duration: trainingForBusiness.duration,
            format: trainingForBusiness.format,
            rationale: trainingForBusiness.rationale,
          }
        : null,
      feasibility: computeJourneyFeasibility({
        businessScore: selectedBusiness?.feasibility,
        locationScore: selectedLocation?.feasibility,
        budgetScore: proposal.feasibility ?? budgetAssessment?.feasibility,
      }),
    });
    clearSearchSeed();
    navigate('/projet/apercu');
  };

  const handleRefine = () => {
    if (step === 'businesses') {
      fetchBusinesses(refine, businesses.map((b) => b.title));
    } else if (step === 'locations') {
      fetchLocations(selectedBusiness, refine, locations.map((l) => l.label));
    } else if (step === 'proposals') {
      fetchProposals(selectedBusiness, selectedLocation, refine);
    }
  };

  const goBack = () => {
    setError('');
    setRefine('');
    if (step === 'locations') setStep('businesses');
    else if (step === 'proposals') setStep('locations');
  };

  const seed = seedRef.current;

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 flex items-center justify-between gap-3">
          <Link
            to="/creer-son-avenir"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-prune-100 text-prune-700 hover:bg-prune-200 transition-colors"
            aria-label="Retour"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <BrandLogo size="sm" />
          <div className="w-10" aria-hidden="true" />
        </div>
      </header>

      <main className="page-container flex-1 py-6 sm:py-10 max-w-[57.6rem]">
        <div className="mb-6 sm:mb-8">
          <Stepper current={step} />
        </div>

        {seed && (
          <p className="text-center text-xs sm:text-sm text-prune-500 mb-4">
            Idée : <span className="font-medium text-prune-800">{seed.quoi}</span> ·
            {' '}Zone : <span className="font-medium text-prune-800">{seed.ou || 'à préciser'}</span> ·
            {' '}Budget : <span className="font-medium text-wasabi-700">{formatBudget(seed.budget, seed.currency)}</span>
          </p>
        )}

        <div className="mb-6">
          <FeasibilityGauge score={feasibilityScore} />
        </div>

        {step !== 'businesses' && (
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-1 text-sm text-prune-500 hover:text-prune-700"
          >
            <IconChevronRight className="w-4 h-4 rotate-180" />
            Étape précédente
          </button>
        )}

        {error && <p className="alert-error mb-4">{error}</p>}

        <section className="space-y-5">
          <header>
            <h1 className="text-xl sm:text-2xl font-bold text-prune-900">
              {step === 'businesses' && 'Choisissez un business'}
              {step === 'locations' && 'Choisissez un lieu'}
              {step === 'proposals' && 'Choisissez votre projet'}
            </h1>
            <p className="mt-1 text-sm text-prune-500">
              {step === 'businesses' &&
                "Idées générées par l'IA. Choisissez-en une, ou demandez une formation utile avant de continuer."}
              {step === 'locations' &&
                `Lieux adaptés à « ${selectedBusiness?.title} »${seed?.ou ? ` autour de ${seed.ou}` : ''}. Sélectionnez-en un ou affinez.`}
              {step === 'proposals' &&
                (budgetAssessment?.adjustedProposed
                  ? '4 projets : votre budget, flexible, idéal IA, et un budget ajusté plus bas jugé viable.'
                  : '3 projets : votre budget, un budget flexible, et le budget idéal IA. Un 4ᵉ « ajusté » n’apparaît que si un budget plus bas est viable.')}
            </p>
          </header>

          {loading ? (
            <div className="py-16 text-center text-prune-500 text-sm">
              L&apos;IA réfléchit…
            </div>
          ) : (
            <>
              {step === 'businesses' && (
                <div className="grid gap-4">
                  {businesses.map((business, index) => {
                    const hasSaved =
                      savedTraining?.businessTitle === business.title && savedTraining?.title;
                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-prune-100 bg-white p-5 hover:border-prune-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-prune-900">{business.title}</h3>
                          {business.feasibility != null && (
                            <span className="shrink-0 text-xs font-bold tabular-nums text-prune-600">
                              {business.feasibility}%
                            </span>
                          )}
                        </div>
                        {business.activity && (
                          <p className="text-xs font-medium uppercase tracking-wide text-topaz-600 mt-0.5">
                            {business.activity}
                          </p>
                        )}
                        {business.pitch && (
                          <p className="text-sm text-prune-700 mt-2">{business.pitch}</p>
                        )}
                        {business.rationale && (
                          <p className="text-sm text-prune-500 mt-1">{business.rationale}</p>
                        )}
                        {hasSaved && (
                          <p className="mt-2 text-xs font-medium text-wasabi-700">
                            Formation mise de côté : {savedTraining.title}
                          </p>
                        )}
                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectBusiness(business)}
                            className="btn-primary flex-1"
                          >
                            Choisir ce business
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openTrainingAssist(business, e)}
                            className="btn-secondary flex-1"
                          >
                            Formation utile ?
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 'locations' && (
                <div className="grid gap-4">
                  {locations.map((location, index) => (
                    <SelectableCard key={index} onSelect={() => handleSelectLocation(location)}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-prune-900">
                          {location.label}
                          {location.city ? ` — ${location.city}` : ''}
                        </h3>
                        {location.feasibility != null && (
                          <span className="shrink-0 text-xs font-bold tabular-nums text-prune-600">
                            {location.feasibility}%
                          </span>
                        )}
                      </div>
                      {location.area && (
                        <p className="text-xs font-medium uppercase tracking-wide text-topaz-600 mt-0.5">
                          {location.area}
                        </p>
                      )}
                      {location.rationale && (
                        <p className="text-sm text-prune-500 mt-2">{location.rationale}</p>
                      )}
                    </SelectableCard>
                  ))}
                </div>
              )}

              {step === 'proposals' && (
                <div className="space-y-4">
                  {budgetAssessment?.userBudgetTooHigh && budgetAssessment.message && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold mb-1">Votre budget de départ semble trop élevé</p>
                      <p>{budgetAssessment.message}</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {proposals.map((proposal, index) => (
                      <SelectableCard key={index} onSelect={() => handleSelectProposal(proposal)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={[
                              'inline-block text-xs font-semibold px-2 py-0.5 rounded-full',
                              proposalKindClass(proposal.kind),
                            ].join(' ')}
                          >
                            {proposalKindLabel(proposal.kind)}
                          </span>
                          {proposal.feasibility != null && (
                            <span className="shrink-0 text-xs font-bold tabular-nums text-prune-600">
                              {proposal.feasibility}%
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-prune-900">{proposal.title}</h3>
                        <p className="text-lg font-bold text-wasabi-700 mt-1">
                          {formatBudget(proposal.budget, proposal.currency)}
                        </p>
                        {proposal.report && (
                          <p className="text-sm text-prune-600 mt-2 line-clamp-6">{proposal.report}</p>
                        )}
                      </SelectableCard>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <RefineBar
                  placeholder={
                    step === 'businesses'
                      ? 'Ex : plutôt tourné vers le bio et le local'
                      : step === 'locations'
                        ? 'Ex : proche des transports, zone piétonne'
                        : 'Ex : réduire les coûts de départ'
                  }
                  value={refine}
                  onChange={setRefine}
                  onSubmit={handleRefine}
                  disabled={loading}
                />
              </div>
            </>
          )}
        </section>
      </main>

      {trainingBusiness && (
        <TrainingModal
          business={trainingBusiness}
          trainings={trainings}
          loading={trainingLoading}
          error={trainingError}
          refine={trainingRefine}
          onRefineChange={setTrainingRefine}
          onRefine={() =>
            fetchTrainings(
              trainingBusiness,
              trainingRefine,
              trainings.map((t) => t.title)
            )
          }
          savedTitle={
            savedTraining?.businessTitle === trainingBusiness.title
              ? savedTraining.title
              : null
          }
          onSave={(training) =>
            setSavedTraining({
              businessTitle: trainingBusiness.title,
              ...training,
            })
          }
          onClose={closeTrainingAssist}
        />
      )}
    </div>
  );
}

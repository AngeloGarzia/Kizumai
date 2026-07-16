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

    saveProjectDraft({
      quoi: selectedBusiness.title,
      ou: locationLabel,
      budget: proposal.budget,
      currency: proposal.currency || seed.currency,
      source: 'ai',
      title: proposal.title,
      report: proposal.report,
      sections: proposal.sections,
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

      <main className="page-container flex-1 py-6 sm:py-10 max-w-3xl">
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
              {step === 'businesses' && "3 idées générées par l'IA. Sélectionnez-en une ou affinez la recherche."}
              {step === 'locations' &&
                `5 lieux adaptés à « ${selectedBusiness?.title} »${seed?.ou ? ` autour de ${seed.ou}` : ''}. Sélectionnez-en un ou affinez.`}
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
                  {businesses.map((business, index) => (
                    <SelectableCard key={index} onSelect={() => handleSelectBusiness(business)}>
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
                    </SelectableCard>
                  ))}
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
    </div>
  );
}

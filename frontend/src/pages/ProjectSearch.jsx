import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import FeasibilityGauge, {
  averageFeasibility,
  computeJourneyFeasibility,
} from '../components/FeasibilityGauge.jsx';
import FeasibilityRoundPill from '../components/FeasibilityRoundPill.jsx';
import {
  projectService,
  getSearchSeed,
  getSearchProgress,
  saveSearchSeed,
  saveSearchProgress,
  saveProjectDraft,
} from '../services/projectService.js';
import { IconChevronRight } from '../components/icons.jsx';
import FranceImplantationModal from '../components/FranceImplantationModal.jsx';
import FabulousThinking from '../components/FabulousThinking.jsx';
import TrainingAssistModal from '../components/TrainingAssistModal.jsx';
import MobilitySetupPanel from '../components/MobilitySetupPanel.jsx';
import DigitalSetupPanel from '../components/DigitalSetupPanel.jsx';
import { assistantPhrases } from '../constants/assistant.js';
import BusinessMetricPills from '../components/BusinessMetricPills.jsx';
import MetricPillDetailModal from '../components/MetricPillDetailModal.jsx';
import {
  LOCATION_MODE,
  LOCATION_MODE_META,
  ensureBusinessModes,
  formatDigitalSetupLabel,
  formatMobilityLabel,
} from '../constants/locationModes.js';
import ProfitabilitySegmentsPill from '../components/ProfitabilitySegmentsPill.jsx';
import {
  normalizeProfitability,
  profitabilityDisplayLabel,
} from '../utils/profitabilityPill.js';
import { buildMetricPillDetail } from '../utils/metricPillDetail.js';

const BASE_STEPS = [
  { key: 'businesses', label: 'Business' },
  { key: 'locations', label: 'Lieu' },
  { key: 'proposals', label: 'Projet' },
];

const VALID_STEPS = new Set(BASE_STEPS.map((s) => s.key));

function normalizeStep(value) {
  return VALID_STEPS.has(value) ? value : 'businesses';
}

function formatBudget(amount, currency) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function Stepper({ current, middleLabel = 'Lieu' }) {
  const steps = BASE_STEPS.map((s) =>
    s.key === 'locations' ? { ...s, label: middleLabel } : s
  );
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
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
            {index < steps.length - 1 && (
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
        {assistantPhrases.refineWith}
      </button>
    </form>
  );
}

export default function ProjectSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seedRef = useRef(null);
  const bootstrappedRef = useRef(false);
  const persistReadyRef = useRef(false);

  const [step, setStep] = useState(() => normalizeStep(searchParams.get('step')));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refine, setRefine] = useState('');

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [mobilitySetup, setMobilitySetup] = useState(null);
  const [digitalSetup, setDigitalSetup] = useState(null);

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

  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapSummary, setMapSummary] = useState('');
  const [mapRegions, setMapRegions] = useState([]);
  const [mapSelectedCode, setMapSelectedCode] = useState(null);
  const [metricDetail, setMetricDetail] = useState(null);

  const goToStep = useCallback(
    (nextStep, { replace = false } = {}) => {
      const normalized = normalizeStep(nextStep);
      setStep(normalized);
      navigate(`/projet/recherche?step=${normalized}`, { replace });
    },
    [navigate]
  );

  const proposalKindLabel = (kind) => {
    if (kind === 'budget_ideal') return assistantPhrases.idealBudget;
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

  // Jauge parcours : idée / ancrage / budget selon l'avancement des choix.
  const feasibilityScore = useMemo(() => {
    const businessScore =
      selectedMode?.feasibility ??
      selectedBusiness?.feasibility ??
      averageFeasibility(businesses);
    const locationScore =
      selectedMode?.type === LOCATION_MODE.NOMADIC && mobilitySetup
        ? selectedMode?.feasibility ?? selectedBusiness?.feasibility
        : selectedMode?.type === LOCATION_MODE.DEMATERIALIZED && digitalSetup
          ? selectedMode?.feasibility ?? selectedBusiness?.feasibility
          : selectedLocation?.feasibility ??
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
    selectedMode,
    locations,
    selectedLocation,
    mobilitySetup,
    digitalSetup,
    proposals,
    budgetAssessment,
  ]);

  const middleStepLabel =
    LOCATION_MODE_META[selectedMode?.type]?.stepLabel || 'Lieu';

  const sortedBusinesses = useMemo(
    () =>
      [...businesses].sort((a, b) => {
        const ra = Number(a?.fabulousRank);
        const rb = Number(b?.fabulousRank);
        const hasRa = Number.isFinite(ra) && ra >= 1;
        const hasRb = Number.isFinite(rb) && rb >= 1;
        if (hasRa && hasRb && ra !== rb) return ra - rb;
        if (hasRa && !hasRb) return -1;
        if (!hasRa && hasRb) return 1;
        const fa = Number(a?.feasibility);
        const fb = Number(b?.feasibility);
        const sa = Number.isFinite(fa) ? fa : -1;
        const sb = Number.isFinite(fb) ? fb : -1;
        return sb - sa;
      }),
    [businesses]
  );

  const sortedLocations = useMemo(() => {
    const sorted = [...locations].sort((a, b) => {
      const ra = Number(a?.fabulousRank);
      const rb = Number(b?.fabulousRank);
      const hasRa = Number.isFinite(ra) && ra >= 1;
      const hasRb = Number.isFinite(rb) && rb >= 1;
      if (hasRa && hasRb && ra !== rb) return ra - rb;
      if (hasRa && !hasRb) return -1;
      if (!hasRa && hasRb) return 1;
      const fa = Number(a?.feasibility);
      const fb = Number(b?.feasibility);
      const sa = Number.isFinite(fa) ? fa : -1;
      const sb = Number.isFinite(fb) ? fb : -1;
      return sb - sa;
    });
    const allRanked = sorted.every((l) => {
      const r = Number(l?.fabulousRank);
      return Number.isFinite(r) && r >= 1;
    });
    if (allRanked) return sorted;
    return sorted.map((l, idx) => ({ ...l, fabulousRank: idx + 1 }));
  }, [locations]);

  const fabulousPickLabel = (rank) => {
    if (rank === 1) return assistantPhrases.preferredPick;
    if (rank === 2) return assistantPhrases.preferredPickAlt;
    if (rank === 3) return assistantPhrases.preferredPickGood;
    return null;
  };

  /** Fond de tuile clairement distinct selon le rang de prédilection Fabulous (1 = meilleur). */
  const fabulousPreferenceTileClass = (rank) => {
    if (rank === 1) {
      return 'border-wasabi-400 bg-wasabi-100 ring-2 ring-wasabi-300/80 shadow-sm shadow-wasabi-500/15';
    }
    if (rank === 2) {
      return 'border-topaz-400 bg-topaz-100 ring-1 ring-topaz-300/70';
    }
    if (rank === 3) {
      return 'border-amber-300 bg-amber-50';
    }
    if (rank === 4) {
      return 'border-prune-200 bg-prune-50';
    }
    if (Number.isFinite(rank) && rank >= 5) {
      return 'border-prune-100 bg-white';
    }
    return 'border-prune-100 bg-white';
  };

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
        temperature: seed.temperature,
      });
      setBusinesses(result);
      const prev = getSearchProgress() || {};
      saveSearchProgress({
        ...prev,
        step: 'businesses',
        seed,
        businesses: result,
        selectedBusiness: prev.selectedBusiness || null,
        selectedMode: prev.selectedMode || null,
        mobilitySetup: prev.mobilitySetup || null,
        digitalSetup: prev.digitalSetup || null,
        locations: prev.locations || [],
        selectedLocation: prev.selectedLocation || null,
        proposals: prev.proposals || [],
        budgetAssessment: prev.budgetAssessment || null,
        savedTraining: prev.savedTraining || null,
      });
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
        temperature: seed.temperature,
      });
      setLocations(result);
      const prev = getSearchProgress() || {};
      saveSearchProgress({
        ...prev,
        step: 'locations',
        seed,
        businesses: prev.businesses || [],
        selectedBusiness: business,
        selectedMode: prev.selectedMode || null,
        mobilitySetup: prev.mobilitySetup || null,
        digitalSetup: prev.digitalSetup || null,
        locations: result,
        selectedLocation: null,
        proposals: [],
        budgetAssessment: null,
        savedTraining: prev.savedTraining || null,
      });
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
        temperature: seed?.temperature,
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

  const fetchProposals = useCallback(async (business, locationLabel, refineText = '', modeType = 'fixed') => {
    const seed = seedRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await projectService.buildProposals({
        business: business.title,
        location: locationLabel,
        locationMode: modeType,
        budget: seed.budget,
        currency: seed.currency,
        refine: refineText,
        temperature: seed.temperature,
      });
      setProposals(result.proposals || []);
      setBudgetAssessment(result.assessment || null);
      const prev = getSearchProgress() || {};
      saveSearchProgress({
        ...prev,
        step: 'proposals',
        seed,
        businesses: prev.businesses || [],
        selectedBusiness: business,
        selectedMode: prev.selectedMode || null,
        mobilitySetup: prev.mobilitySetup || null,
        digitalSetup: prev.digitalSetup || null,
        locations: prev.locations || [],
        selectedLocation: prev.selectedLocation || null,
        proposals: result.proposals || [],
        budgetAssessment: result.assessment || null,
        savedTraining: prev.savedTraining || null,
      });
    } catch (err) {
      setError(err.message || 'La recherche a échoué.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let seed = getSearchSeed();
    const progress = getSearchProgress();

    if (!seed && progress?.seed) {
      saveSearchSeed(progress.seed);
      seed = progress.seed;
    }

    if (!seed) {
      navigate('/creer-son-avenir', { replace: true });
      return;
    }

    seedRef.current = seed;

    const urlStep = normalizeStep(
      new URLSearchParams(window.location.search).get('step') || progress?.step
    );
    const canRestore =
      progress &&
      Array.isArray(progress.businesses) &&
      progress.businesses.length > 0;

    if (canRestore) {
      setBusinesses(progress.businesses || []);
      setSelectedBusiness(progress.selectedBusiness || null);
      setSelectedMode(progress.selectedMode || null);
      setMobilitySetup(progress.mobilitySetup || null);
      setDigitalSetup(progress.digitalSetup || null);
      setLocations(progress.locations || []);
      setSelectedLocation(progress.selectedLocation || null);
      setProposals(progress.proposals || []);
      setBudgetAssessment(progress.budgetAssessment || null);
      setSavedTraining(progress.savedTraining || null);
      goToStep(urlStep, { replace: true });
      persistReadyRef.current = true;

      const modeType = progress.selectedMode?.type || LOCATION_MODE.FIXED;
      if (
        urlStep === 'locations' &&
        modeType === LOCATION_MODE.FIXED &&
        !(progress.locations || []).length &&
        progress.selectedBusiness
      ) {
        fetchLocations(progress.selectedBusiness, '', []);
      } else if (
        urlStep === 'proposals' &&
        !(progress.proposals || []).length &&
        progress.selectedBusiness
      ) {
        const label =
          modeType === LOCATION_MODE.NOMADIC
            ? formatMobilityLabel(progress.mobilitySetup)
            : modeType === LOCATION_MODE.DEMATERIALIZED
              ? formatDigitalSetupLabel(progress.digitalSetup)
              : progress.selectedLocation
                ? [progress.selectedLocation.label, progress.selectedLocation.city]
                    .filter(Boolean)
                    .join(' — ')
                : '';
        if (label) {
          fetchProposals(progress.selectedBusiness, label, '', modeType);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
      return;
    }

    goToStep('businesses', { replace: true });
    persistReadyRef.current = true;
    fetchBusinesses('', []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on mount
  }, [navigate, fetchBusinesses, goToStep, fetchLocations, fetchProposals]);

  // Navigateur précédent / suivant : synchroniser l'étape depuis l'URL.
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const urlStep = normalizeStep(searchParams.get('step'));
    setStep((current) => (current === urlStep ? current : urlStep));
  }, [searchParams]);

  // Persister la progression à chaque changement utile.
  useEffect(() => {
    if (!persistReadyRef.current || !seedRef.current) return;
    saveSearchProgress({
      step,
      seed: seedRef.current,
      businesses,
      selectedBusiness,
      selectedMode,
      mobilitySetup,
      digitalSetup,
      locations,
      selectedLocation,
      proposals,
      budgetAssessment,
      savedTraining,
    });
  }, [
    step,
    businesses,
    selectedBusiness,
    selectedMode,
    mobilitySetup,
    digitalSetup,
    locations,
    selectedLocation,
    proposals,
    budgetAssessment,
    savedTraining,
  ]);

  const goToLocations = (business, zone) => {
    if (zone && seedRef.current) {
      seedRef.current = { ...seedRef.current, ou: zone };
      saveSearchSeed(seedRef.current);
    }
    setSelectedLocation(null);
    setLocations([]);
    setRefine('');
    goToStep('locations');
    setMapOpen(false);
    fetchLocations(business, '', []);
  };

  const goToModeSetup = (business, mode) => {
    setSelectedBusiness(business);
    setSelectedMode(mode);
    setRefine('');
    setProposals([]);
    setBudgetAssessment(null);
    setSelectedLocation(null);
    setLocations([]);
    goToStep('locations');
    if (mode.type === LOCATION_MODE.FIXED) {
      const hasPlace = Boolean(seedRef.current?.ou?.trim());
      if (!hasPlace) {
        setMapOpen(true);
        fetchFranceMap(business);
        return;
      }
      fetchLocations(business, '', []);
    }
  };

  const fetchFranceMap = useCallback(async (business) => {
    const seed = seedRef.current;
    setMapLoading(true);
    setMapError('');
    setMapSummary('');
    setMapRegions([]);
    setMapSelectedCode(null);
    try {
      const result = await projectService.evaluateFranceImplantation({
        business: business.title,
        businessActivity: business.activity,
        businessPitch: business.pitch,
        businessRationale: business.rationale,
        budget: seed.budget,
        currency: seed.currency,
        temperature: seed.temperature,
      });
      setMapSummary(result.summary || '');
      setMapRegions(result.regions || []);
    } catch (err) {
      setMapError(err.message || 'Impossible de charger la carte.');
    } finally {
      setMapLoading(false);
    }
  }, []);

  const handleSelectBusinessMode = (business, mode) => {
    goToModeSetup(business, mode);
  };

  const openFranceMap = () => {
    if (!selectedBusiness) return;
    setMapOpen(true);
    setMapError('');
    fetchFranceMap(selectedBusiness);
  };

  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setProposals([]);
    setBudgetAssessment(null);
    setRefine('');
    goToStep('proposals');
    const locationLabel = [location.label, location.city].filter(Boolean).join(' — ');
    fetchProposals(selectedBusiness, locationLabel, '', LOCATION_MODE.FIXED);
  };

  const handleMobilitySubmit = (mobility) => {
    setMobilitySetup(mobility);
    setProposals([]);
    setBudgetAssessment(null);
    setRefine('');
    goToStep('proposals');
    fetchProposals(selectedBusiness, formatMobilityLabel(mobility), '', LOCATION_MODE.NOMADIC);
  };

  const handleDigitalSubmit = (setup) => {
    setDigitalSetup(setup);
    setProposals([]);
    setBudgetAssessment(null);
    setRefine('');
    goToStep('proposals');
    fetchProposals(selectedBusiness, formatDigitalSetupLabel(setup), '', LOCATION_MODE.DEMATERIALIZED);
  };

  const resolveAnchorageLabel = () => {
    if (selectedMode?.type === LOCATION_MODE.NOMADIC) {
      return formatMobilityLabel(mobilitySetup);
    }
    if (selectedMode?.type === LOCATION_MODE.DEMATERIALIZED) {
      return formatDigitalSetupLabel(digitalSetup);
    }
    if (selectedLocation) {
      return [selectedLocation.label, selectedLocation.city].filter(Boolean).join(' — ');
    }
    return '';
  };

  const handleSelectProposal = (proposal) => {
    const seed = seedRef.current;
    const locationLabel = resolveAnchorageLabel();
    const modeType = selectedMode?.type || LOCATION_MODE.FIXED;

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
      locationMode: modeType,
      metadata: {
        locationMode: modeType,
        selectedMode: selectedMode
          ? {
              type: selectedMode.type,
              label: selectedMode.label,
              angle: selectedMode.angle,
              feasibility: selectedMode.feasibility,
            }
          : null,
        mobility: modeType === LOCATION_MODE.NOMADIC ? mobilitySetup : null,
        digitalSetup: modeType === LOCATION_MODE.DEMATERIALIZED ? digitalSetup : null,
        competition:
          selectedBusiness.competitionScore != null ||
          selectedBusiness.competitionLabel ||
          selectedBusiness.competitionNote
            ? {
                score: selectedBusiness.competitionScore ?? null,
                label: selectedBusiness.competitionLabel || null,
                note: selectedBusiness.competitionNote || null,
                source: selectedBusiness.competitionSource || null,
              }
            : null,
        profitability: {
          score:
            proposal.profitabilityScore ?? selectedBusiness.profitabilityScore ?? null,
          label:
            proposal.profitabilityLabel || selectedBusiness.profitabilityLabel || null,
          note:
            proposal.profitabilityNote || selectedBusiness.profitabilityNote || null,
        },
        budgetPlan: {
          kind: proposal.kind || 'budget_utilisateur',
          label: proposalKindLabel(proposal.kind),
          selectedBudget: proposal.budget,
          currency: proposal.currency || seed.currency,
          feasibility: proposal.feasibility ?? null,
          userSeedBudget: seed.budget ?? null,
        },
      },
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
        businessScore: selectedMode?.feasibility ?? selectedBusiness?.feasibility,
        locationScore:
          modeType === LOCATION_MODE.FIXED
            ? selectedLocation?.feasibility
            : selectedMode?.feasibility ?? selectedBusiness?.feasibility,
        budgetScore: proposal.feasibility ?? budgetAssessment?.feasibility,
      }),
      feasibilityBreakdown: {
        business: {
          score: selectedMode?.feasibility ?? selectedBusiness?.feasibility ?? null,
          weight: 0.4,
          label: 'Idée / business',
        },
        location: {
          score:
            modeType === LOCATION_MODE.FIXED
              ? selectedLocation?.feasibility ?? null
              : selectedMode?.feasibility ?? selectedBusiness?.feasibility ?? null,
          weight: 0.35,
          label:
            modeType === LOCATION_MODE.NOMADIC
              ? 'Ancrage mobilité'
              : modeType === LOCATION_MODE.DEMATERIALIZED
                ? 'Setup digital'
                : 'Lieu',
        },
        budget: {
          score: proposal.feasibility ?? budgetAssessment?.feasibility ?? null,
          weight: 0.25,
          label: 'Budget',
        },
      },
    });
    // Garde seed + progression pour pouvoir revenir modifier le parcours.
    saveSearchProgress({
      step: 'proposals',
      seed: seedRef.current,
      businesses,
      selectedBusiness,
      selectedMode,
      mobilitySetup,
      digitalSetup,
      locations,
      selectedLocation,
      proposals,
      budgetAssessment,
      savedTraining,
    });
    navigate('/projet/apercu');
  };

  const handleRefine = () => {
    if (step === 'businesses') {
      fetchBusinesses(refine, businesses.map((b) => b.title));
    } else if (step === 'locations' && selectedMode?.type === LOCATION_MODE.FIXED) {
      fetchLocations(selectedBusiness, refine, locations.map((l) => l.label));
    } else if (step === 'proposals') {
      const label = resolveAnchorageLabel();
      if (label) {
        fetchProposals(selectedBusiness, label, refine, selectedMode?.type || LOCATION_MODE.FIXED);
      }
    }
  };

  const goBack = () => {
    setError('');
    setRefine('');
    if (step === 'locations') {
      setSelectedMode(null);
      setMobilitySetup(null);
      setDigitalSetup(null);
      goToStep('businesses');
    } else if (step === 'proposals') goToStep('locations');
    else navigate('/creer-son-avenir');
  };

  const seed = seedRef.current;

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 flex items-center justify-center gap-3">
          <BrandLogo size="sm" />
        </div>
      </header>

      <main className="page-container flex-1 py-6 sm:py-10 max-w-[57.6rem]">
        <div className="mb-6 sm:mb-8">
          <Stepper current={step} middleLabel={middleStepLabel} />
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
              {step === 'locations' &&
                (selectedMode?.type === LOCATION_MODE.NOMADIC
                  ? 'Définissez votre mobilité'
                  : selectedMode?.type === LOCATION_MODE.DEMATERIALIZED
                    ? 'Configurez le setup digital'
                    : 'Choisissez un lieu')}
              {step === 'proposals' && 'Choisissez votre projet'}
            </h1>
            <p className="mt-1 text-sm text-prune-500">
              {step === 'businesses' &&
                `${assistantPhrases.ideasBy} Chaque idée peut proposer un mode ancré, nomade ou dématérialisé (une idée = une carte).`}
              {step === 'locations' &&
                (selectedMode?.type === LOCATION_MODE.NOMADIC
                  ? `Point de référence et rayon pour « ${selectedBusiness?.title} ».`
                  : selectedMode?.type === LOCATION_MODE.DEMATERIALIZED
                    ? `Hébergement, marché, travail et siège légal pour « ${selectedBusiness?.title} ».`
                    : `Lieux adaptés à « ${selectedBusiness?.title} »${seed?.ou ? ` autour de ${seed.ou}` : ''}. Sélectionnez-en un ou affinez.`)}
              {step === 'proposals' &&
                (budgetAssessment?.adjustedProposed
                  ? `4 projets : votre budget, flexible, ${assistantPhrases.idealBudgetShort}, et un budget ajusté plus bas jugé viable.`
                  : `3 projets : votre budget, un budget flexible, et le budget ${assistantPhrases.idealBudgetShort}. Un 4ᵉ « ajusté » n’apparaît que si un budget plus bas est viable.`)}
            </p>
          </header>

          {loading ? (
            <FabulousThinking message={assistantPhrases.thinking} />
          ) : (
            <>
              {step === 'businesses' && (
                <div className="grid gap-4">
                  {sortedBusinesses.map((business, index) => {
                    const hasSaved =
                      savedTraining?.businessTitle === business.title && savedTraining?.title;
                    const modes = ensureBusinessModes(business);
                    const pickRank = Number(business.fabulousRank);
                    const pickLabel = fabulousPickLabel(pickRank);
                    return (
                      <div
                        key={index}
                        className={[
                          'rounded-2xl border p-4 sm:p-5 hover:shadow-sm transition-all min-w-0 w-full max-w-full overflow-hidden',
                          fabulousPreferenceTileClass(pickRank),
                        ].join(' ')}
                      >
                        <BusinessMetricPills
                          business={business}
                          size="sm"
                          className="w-full justify-start sm:justify-end"
                          onOpenDetail={setMetricDetail}
                        />
                        {pickLabel && (
                          <span
                            className={[
                              'mt-3 inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide truncate',
                              pickRank === 1
                                ? 'bg-wasabi-600 text-white fabulous-pick-blink'
                                : pickRank === 2
                                  ? 'bg-topaz-500 text-white'
                                  : 'bg-amber-500 text-white',
                            ].join(' ')}
                            title={business.fabulousPickNote || pickLabel}
                          >
                            {pickLabel}
                          </span>
                        )}
                        <h3
                          className={[
                            'font-semibold text-prune-900 break-words',
                            pickLabel ? 'mt-1.5' : 'mt-3',
                          ].join(' ')}
                        >
                          {business.title}
                        </h3>
                        {business.activity && (
                          <p className="text-xs font-medium uppercase tracking-wide text-topaz-600 mt-0.5 break-words">
                            {business.activity}
                          </p>
                        )}
                        {business.pitch && (
                          <p className="text-sm text-prune-700 mt-2 break-words">{business.pitch}</p>
                        )}
                        {business.rationale && (
                          <p className="text-sm text-prune-500 mt-1 break-words">{business.rationale}</p>
                        )}
                        {hasSaved && (
                          <p className="mt-2 text-xs font-medium text-wasabi-700 break-words">
                            Formation mise de côté : {savedTraining.title}
                          </p>
                        )}
                        <div
                          className={[
                            'mt-4 grid gap-2 min-w-0',
                            modes.length >= 3
                              ? 'grid-cols-3'
                              : modes.length === 2
                                ? 'grid-cols-2'
                                : 'grid-cols-1',
                          ].join(' ')}
                        >
                          {modes.map((mode) => {
                            const meta = LOCATION_MODE_META[mode.type];
                            const ModeIcon = meta.Icon;
                            return (
                              <button
                                key={mode.type}
                                type="button"
                                onClick={() => handleSelectBusinessMode(business, mode)}
                                title={mode.angle || meta.shortLabel}
                                className={[
                                  'flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-all hover:shadow-sm hover:ring-2 min-w-0',
                                  meta.tileClass,
                                ].join(' ')}
                              >
                                <span
                                  className={[
                                    'inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full',
                                    meta.iconWrapClass,
                                  ].join(' ')}
                                >
                                  <ModeIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                                </span>
                                <span className="text-xs sm:text-sm font-semibold leading-tight break-words">
                                  {mode.label || meta.shortLabel}
                                </span>
                                {mode.feasibility != null && (
                                  <span className="text-xs font-semibold tabular-nums opacity-80">
                                    {mode.feasibility}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => openTrainingAssist(business, e)}
                          className="btn-secondary w-full mt-2"
                        >
                          Formation utile ?
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 'locations' && selectedMode?.type === LOCATION_MODE.NOMADIC && (
                <MobilitySetupPanel
                  businessTitle={selectedBusiness?.title}
                  initial={mobilitySetup}
                  onSubmit={handleMobilitySubmit}
                  disabled={loading}
                />
              )}

              {step === 'locations' && selectedMode?.type === LOCATION_MODE.DEMATERIALIZED && (
                <DigitalSetupPanel
                  businessTitle={selectedBusiness?.title}
                  initial={digitalSetup}
                  onSubmit={handleDigitalSubmit}
                  disabled={loading}
                />
              )}

              {step === 'locations' &&
                (!selectedMode || selectedMode.type === LOCATION_MODE.FIXED) && (
                <div className="grid gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-prune-100 bg-white p-4">
                    <p className="text-sm text-prune-600">
                      Zone actuelle :{' '}
                      <span className="font-medium text-prune-900">
                        {seed?.ou || 'France entière'}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={openFranceMap}
                      disabled={loading || mapLoading}
                      className="btn-secondary w-full sm:w-auto whitespace-nowrap disabled:opacity-50"
                    >
                      Changer de région (carte)
                    </button>
                  </div>
                  {sortedLocations.map((location, index) => {
                    const pickRank = Number(location.fabulousRank);
                    const pickLabel = fabulousPickLabel(pickRank);
                    const placeTitle = [location.label, location.city]
                      .filter(Boolean)
                      .join(' — ');
                    return (
                      <div
                        key={index}
                        className={[
                          'rounded-2xl border p-4 sm:p-5 hover:shadow-sm transition-all min-w-0 w-full max-w-full overflow-hidden',
                          fabulousPreferenceTileClass(pickRank),
                        ].join(' ')}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <FeasibilityRoundPill
                            score={location.feasibility}
                            size="sm"
                            onClick={() =>
                              setMetricDetail(
                                buildMetricPillDetail('feasibility', {
                                  score: location.feasibility,
                                  businessTitle: placeTitle,
                                  rationale: location.rationale,
                                  note:
                                    location.feasibilityNote ||
                                    location.fabulousPickNote ||
                                    null,
                                })
                              )
                            }
                          />
                          {pickLabel && (
                            <span
                              className={[
                                'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide truncate',
                                pickRank === 1
                                  ? 'bg-wasabi-600 text-white fabulous-pick-blink'
                                  : pickRank === 2
                                    ? 'bg-topaz-500 text-white'
                                    : 'bg-amber-500 text-white',
                              ].join(' ')}
                              title={location.fabulousPickNote || pickLabel}
                            >
                              {pickLabel}
                            </span>
                          )}
                        </div>
                        <h3
                          className={[
                            'font-semibold text-prune-900 break-words',
                            pickLabel ? 'mt-1.5' : 'mt-3',
                          ].join(' ')}
                        >
                          {placeTitle}
                        </h3>
                        {location.area && (
                          <p className="text-xs font-medium uppercase tracking-wide text-topaz-600 mt-0.5 break-words">
                            {location.area}
                          </p>
                        )}
                        {location.rationale && (
                          <p className="text-sm text-prune-500 mt-2 break-words">
                            {location.rationale}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectLocation(location)}
                          className="btn-primary w-full mt-4"
                        >
                          Choisir ce lieu
                        </button>
                      </div>
                    );
                  })}
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
                          <div className="shrink-0 flex items-center gap-1.5">
                            <ProfitabilitySegmentsPill
                              profitability={normalizeProfitability(proposal) || proposal}
                              size="sm"
                              title={
                                [
                                  proposal.profitabilityNote,
                                  profitabilityDisplayLabel(proposal),
                                  'Cliquez pour le détail',
                                ]
                                  .filter(Boolean)
                                  .join(' — ') || 'Rentabilité'
                              }
                              onClick={() =>
                                setMetricDetail(
                                  buildMetricPillDetail('profitability', {
                                    score: proposal.profitabilityScore,
                                    label: profitabilityDisplayLabel(proposal),
                                    note: proposal.profitabilityNote,
                                    businessTitle: proposal.title,
                                    pitch: proposal.report,
                                  })
                                )
                              }
                            />
                            <FeasibilityRoundPill
                              score={proposal.feasibility}
                              size="sm"
                              onClick={() =>
                                setMetricDetail(
                                  buildMetricPillDetail('feasibility', {
                                    score: proposal.feasibility,
                                    businessTitle: proposal.title,
                                    pitch: proposal.report,
                                  })
                                )
                              }
                            />
                          </div>
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
                      : step === 'locations' && selectedMode?.type === LOCATION_MODE.FIXED
                        ? 'Ex : proche des transports, zone piétonne'
                        : step === 'proposals'
                          ? 'Ex : réduire les coûts de départ'
                          : 'Ex : préciser une contrainte'
                  }
                  value={refine}
                  onChange={setRefine}
                  onSubmit={handleRefine}
                  disabled={
                    loading ||
                    (step === 'locations' &&
                      selectedMode?.type &&
                      selectedMode.type !== LOCATION_MODE.FIXED)
                  }
                />
              </div>
            </>
          )}
        </section>
      </main>

      <MetricPillDetailModal
        detail={metricDetail}
        onClose={() => setMetricDetail(null)}
      />

      {mapOpen && selectedBusiness && (
        <FranceImplantationModal
          business={selectedBusiness}
          loading={mapLoading}
          error={mapError}
          summary={mapSummary}
          regions={mapRegions}
          selectedCode={mapSelectedCode}
          onSelectRegion={(region) => setMapSelectedCode(region.code)}
          onConfirmCity={(region, city) => {
            const zone = [city.name, region?.name].filter(Boolean).join(' — ');
            goToLocations(selectedBusiness, zone);
          }}
          onEvaluateCity={async ({ city, region }) => {
            const seed = seedRef.current;
            return projectService.evaluateCityImplantation({
              business: selectedBusiness.title,
              businessActivity: selectedBusiness.activity,
              businessPitch: selectedBusiness.pitch,
              businessRationale: selectedBusiness.rationale,
              city,
              region,
              budget: seed?.budget,
              currency: seed?.currency,
              temperature: seed?.temperature,
            });
          }}
          onSkip={() => goToLocations(selectedBusiness, null)}
          onClose={() => {
            setMapOpen(false);
            setMapError('');
          }}
        />
      )}

      {trainingBusiness && (
        <TrainingAssistModal
          businessTitle={trainingBusiness.title}
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
          closeLabel="Continuer le choix du business"
        />
      )}
    </div>
  );
}

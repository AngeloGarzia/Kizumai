import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import FeasibilityGauge from '../components/FeasibilityGauge.jsx';
import ProjectReport from '../components/ProjectReport.jsx';
import {
  clearProjectDraft,
  clearSearchProgress,
  clearSearchSeed,
  getProjectDraft,
  getSearchProgress,
  getSearchSeed,
  projectService,
  saveProjectDraft,
} from '../services/projectService.js';
import { authService } from '../services/authService.js';
import { IconChevronRight } from '../components/icons.jsx';
import { ASSISTANT_NAME } from '../constants/assistant.js';

export default function ProjectPreview() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isPaid, loading, loadUser } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmUpgradeOpen, setConfirmUpgradeOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  useEffect(() => {
    const draft = getProjectDraft();
    if (!draft) {
      const progress = getSearchProgress();
      if (progress?.businesses?.length) {
        navigate(`/projet/recherche?step=${progress.step || 'proposals'}`, { replace: true });
      } else {
        navigate('/creer-son-avenir', { replace: true });
      }
      return;
    }
    setPreview(draft);
  }, [navigate]);

  useEffect(() => {
    if (!preview) return undefined;
    if (preview.fabulousAnalysis?.summary || preview.fabulousAnalysis?.outlook) {
      return undefined;
    }

    let active = true;
    setAnalysisLoading(true);
    setAnalysisError('');

    const seed = getSearchSeed();
    projectService
      .analyzeProjectPreview({
        title: preview.title,
        business: preview.quoi,
        location: preview.ou,
        budget: preview.budget,
        currency: preview.currency,
        report: preview.report,
        sections: preview.sections,
        training: preview.training,
        feasibility: preview.feasibility,
        temperature: seed?.temperature,
      })
      .then((analysis) => {
        if (!active || !analysis) return;
        const next = { ...preview, fabulousAnalysis: analysis };
        setPreview(next);
        saveProjectDraft(next);
      })
      .catch((err) => {
        if (!active) return;
        setAnalysisError(err.message || `Impossible de générer l’analyse ${ASSISTANT_NAME}`);
      })
      .finally(() => {
        if (active) setAnalysisLoading(false);
      });

    return () => {
      active = false;
    };
    // Une seule génération par brouillon (clé budget+titre) ; preview.id n'existe pas encore.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once per draft identity
  }, [preview?.title, preview?.budget, preview?.quoi, preview?.ou]);

  const handleContinuePaid = async () => {
    if (!preview) return;
    setError('');
    setSubmitting(true);

    try {
      await projectService.createProject(preview);
      clearProjectDraft();
      clearSearchSeed();
      clearSearchProgress();
      navigate('/');
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer le projet");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!preview) return;
    setError('');
    setSubmitting(true);

    try {
      await authService.upgradeToPaid();
      await loadUser();
      await projectService.createProject(preview);
      clearProjectDraft();
      clearSearchSeed();
      clearSearchProgress();
      setConfirmUpgradeOpen(false);
      navigate('/');
    } catch (err) {
      setError(err.message || "Impossible d'activer le compte payant");
      setConfirmUpgradeOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const sourceLabel = useMemo(() => {
    if (!preview) return '';
    if (preview.source === 'ai') return `Complété par ${ASSISTANT_NAME}`;
    if (preview.source === 'heuristic') return 'Estimation automatique';
    return 'Synthèse de vos informations';
  }, [preview]);

  if (loading || !preview) {
    return (
      <div className="min-h-screen min-h-dvh page-bg flex items-center justify-center">
        <p className="text-prune-500 text-sm">Chargement du rapport...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 flex items-center justify-center gap-3">
          <BrandLogo size="sm" />
        </div>
      </header>

      <main className="page-container flex-1 py-6 sm:py-10 max-w-[67.2rem]">
        <button
          type="button"
          onClick={() => navigate('/projet/recherche?step=proposals')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-prune-500 hover:text-prune-700"
        >
          <IconChevronRight className="w-4 h-4 rotate-180" />
          Étape précédente
        </button>

        <section className="text-center sm:text-left mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-prune-600 uppercase">
            Résultat de la recherche
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-prune-900">
            Votre rapport projet
          </h1>
          <p className="mt-2 text-sm sm:text-base text-prune-500">
            {sourceLabel}. Un compte payant est nécessaire pour poursuivre le parcours.
          </p>
        </section>

        <div className="space-y-6">
          {preview.feasibility != null && (
            <FeasibilityGauge score={preview.feasibility} />
          )}
          <ProjectReport
            project={preview}
            fabulousAnalysis={preview.fabulousAnalysis}
            analysisLoading={analysisLoading}
            analysisError={analysisError}
          />

          <div className="card p-5 sm:p-6 space-y-4">
            {error && <p className="alert-error">{error}</p>}

            {isPaid ? (
              <Button type="button" onClick={handleContinuePaid} disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Continuer mon parcours'}
              </Button>
            ) : isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-sm text-prune-600">
                  Votre compte ({user?.email}) n&apos;inclut pas encore l&apos;accès au parcours complet.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setError('');
                    setConfirmUpgradeOpen(true);
                  }}
                  disabled={submitting}
                >
                  Passer en compte payant
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-prune-600">
                  Créez un compte pour poursuivre, puis activez l&apos;accès payant pour enregistrer
                  votre projet.
                </p>
                <Link to="/register" className="btn-primary block text-center">
                  Créer un compte
                </Link>
                <p className="text-xs text-center text-prune-500">
                  Déjà inscrit ?{' '}
                  <Link to="/login" className="link-accent">
                    Se connecter
                  </Link>
                </p>
              </div>
            )}
          </div>
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

      {confirmUpgradeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-paid-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-prune-900/50"
            aria-label="Fermer"
            disabled={submitting}
            onClick={() => {
              if (!submitting) setConfirmUpgradeOpen(false);
            }}
          />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
                Accès parcours
              </p>
              <h2 id="upgrade-paid-title" className="text-lg font-bold text-prune-900 mt-1">
                Confirmer le passage en compte payant ?
              </h2>
              <p className="text-sm text-prune-500 mt-2">
                Votre projet sera enregistré et vous pourrez enchaîner sur le parcours complet
                (étapes, ressources, mémoire projet).
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => setConfirmUpgradeOpen(false)}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleConfirmUpgrade} disabled={submitting}>
                {submitting ? 'Activation...' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

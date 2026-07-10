import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import {
  clearProjectDraft,
  getProjectDraft,
  projectService,
} from '../services/projectService.js';
import { authService } from '../services/authService.js';
import { IconChevronRight } from '../components/icons.jsx';

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="label-field">{label}</p>
      <div className="input-field bg-prune-50 text-prune-800 cursor-default select-text">
        {value}
      </div>
    </div>
  );
}

function formatBudget(amount, currency) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectPreview() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isPaid, loading, loadUser } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const draft = getProjectDraft();
    if (!draft) {
      navigate('/creer-son-avenir', { replace: true });
      return;
    }
    setPreview(draft);
  }, [navigate]);

  const handleContinuePaid = async () => {
    if (!preview) return;
    setError('');
    setSubmitting(true);

    try {
      await projectService.createProject(preview);
      clearProjectDraft();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Impossible d\'enregistrer le projet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpgrade = async () => {
    if (!preview) return;
    setError('');
    setSubmitting(true);

    try {
      await authService.upgradeToPaid();
      await loadUser();
      await projectService.createProject(preview);
      clearProjectDraft();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Impossible d\'activer le compte payant');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !preview) {
    return (
      <div className="min-h-screen min-h-dvh page-bg flex items-center justify-center">
        <p className="text-prune-500 text-sm">Chargement de l&apos;aperçu...</p>
      </div>
    );
  }

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

      <main className="page-container flex-1 py-6 sm:py-10 max-w-2xl">
        <section className="text-center sm:text-left mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-prune-600 uppercase">
            Résultat de la recherche
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-prune-900">
            Votre projet en aperçu
          </h1>
          <p className="mt-2 text-sm sm:text-base text-prune-500">
            Consultez les propositions de l&apos;IA en lecture seule. Un compte payant est nécessaire pour poursuivre.
          </p>
        </section>

        <div className="card p-5 sm:p-8 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-wasabi-700 bg-wasabi-50 border border-wasabi-200 rounded-xl px-4 py-3">
            Aperçu en lecture seule
          </p>

          <ReadOnlyField label="Une idée, une envie ?" value={preview.quoi} />
          <ReadOnlyField label="Où ?" value={preview.ou} />
          <ReadOnlyField
            label="Budget"
            value={formatBudget(preview.budget, preview.currency)}
          />

          {preview.source === 'ai' && (
            <p className="text-xs text-prune-500">
              Champs complétés automatiquement par l&apos;IA.
            </p>
          )}

          {error && <p className="alert-error">{error}</p>}

          {isPaid ? (
            <Button type="button" onClick={handleContinuePaid} disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Continuer mon parcours'}
            </Button>
          ) : isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-prune-600 bg-prune-50 border border-prune-200 rounded-xl px-4 py-3">
                Votre compte ({user?.email}) n&apos;inclut pas encore l&apos;accès au parcours complet.
              </p>
              <Button type="button" onClick={handleUpgrade} disabled={submitting}>
                {submitting ? 'Activation...' : 'Activer le compte payant'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-prune-600 bg-prune-50 border border-prune-200 rounded-xl px-4 py-3">
                Créez un compte payant pour enregistrer ce projet et accéder à la suite du parcours.
              </p>
              <Link to="/register?plan=paid" className="btn-primary block text-center">
                Créer un compte payant
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

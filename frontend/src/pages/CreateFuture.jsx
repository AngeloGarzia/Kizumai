import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import BudgetField from '../components/BudgetField.jsx';
import { projectService, saveProjectDraft } from '../services/projectService.js';
import { IconChevronRight } from '../components/icons.jsx';

export default function CreateFuture() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [quoi, setQuoi] = useState('');
  const [ou, setOu] = useState('');
  const [budget, setBudget] = useState(null);
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasAtLeastOneField = Boolean(quoi.trim() || ou.trim() || budget != null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasAtLeastOneField) {
      setError('Renseignez au moins un champ : Quoi, Où ou Budget');
      return;
    }

    setSubmitting(true);

    const payload = {
      quoi: quoi.trim() || null,
      ou: ou.trim() || null,
      budget,
      currency,
    };

    try {
      const project = await projectService.createProject(payload);

      if (isAuthenticated) {
        navigate('/dashboard');
      } else {
        saveProjectDraft(project);
        navigate('/register');
      }
    } catch (err) {
      setError(err.message || 'Impossible de démarrer le projet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-prune-100 text-prune-700 hover:bg-prune-200 transition-colors"
            aria-label="Retour à l'accueil"
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
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-topaz-600 uppercase">
            Nouveau projet
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-prune-900">
            Démarrez votre projet
          </h1>
          <p className="mt-2 text-sm sm:text-base text-prune-500">
            Renseignez ce que vous savez — l&apos;IA complétera les champs manquants.
          </p>
        </section>

        <div className="card p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="quoi"
              label="Quoi ?"
              value={quoi}
              onChange={(e) => setQuoi(e.target.value)}
              placeholder="Ex : Boutique de produits locaux bio"
            />

            <Input
              id="ou"
              label="Où ?"
              value={ou}
              onChange={(e) => setOu(e.target.value)}
              placeholder="Ex : Lyon, quartier Part-Dieu"
            />

            <BudgetField
              budget={budget}
              onBudgetChange={setBudget}
              currency={currency}
              onCurrencyChange={setCurrency}
            />

            <p className="text-xs text-prune-500 bg-azure-50/60 border border-azure-200/50 rounded-xl px-4 py-3">
              Au moins un champ est requis. Les champs vides seront complétés automatiquement par l&apos;IA.
            </p>

            {error && <p className="alert-error">{error}</p>}

            <Button type="submit" disabled={submitting || !hasAtLeastOneField}>
              {submitting ? 'Recherche et démarrage...' : 'Démarrer mon projet'}
            </Button>

            {!isAuthenticated && (
              <p className="text-xs text-center text-prune-500">
                Vous serez invité à créer un compte pour sauvegarder votre projet.
              </p>
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

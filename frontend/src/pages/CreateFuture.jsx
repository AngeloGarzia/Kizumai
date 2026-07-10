import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import BudgetField from '../components/BudgetField.jsx';
import { projectService, saveProjectDraft } from '../services/projectService.js';
import { IconChevronRight } from '../components/icons.jsx';

export default function CreateFuture() {
  const navigate = useNavigate();

  const [quoi, setQuoi] = useState('');
  const [ou, setOu] = useState('');
  const [budget, setBudget] = useState(null);
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasQuoi = Boolean(quoi.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasQuoi) {
      setError('Décrivez votre idée pour lancer la recherche');
      return;
    }

    setSubmitting(true);

    const payload = {
      quoi: quoi.trim(),
      ou: ou.trim() || null,
      budget,
      currency,
    };

    try {
      const preview = await projectService.previewProject(payload);
      saveProjectDraft(preview);
      navigate('/projet/apercu');
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
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-prune-600 uppercase">
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
              label="Une idée, une envie ?"
              value={quoi}
              onChange={(e) => setQuoi(e.target.value)}
              placeholder="Ex : Boutique de produits locaux bio"
              required
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

            <p className="text-xs text-prune-600 bg-prune-50 border border-prune-200 rounded-xl px-4 py-3">
              Votre idée est requise. Le lieu et le budget peuvent être complétés automatiquement par l&apos;IA.
            </p>

            {error && <p className="alert-error">{error}</p>}

            <Button type="submit" disabled={submitting || !hasQuoi}>
              {submitting ? 'Recherche en cours...' : 'Lancer la recherche'}
            </Button>

            <p className="text-xs text-center text-prune-500">
              Vous verrez un aperçu en lecture seule. Un compte payant est requis pour continuer.
            </p>
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

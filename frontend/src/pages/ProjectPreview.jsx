import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import FeasibilityGauge from '../components/FeasibilityGauge.jsx';
import {
  clearProjectDraft,
  getProjectDraft,
  projectService,
} from '../services/projectService.js';
import { authService } from '../services/authService.js';
import { IconChevronRight } from '../components/icons.jsx';

function formatBudget(amount, currency) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseReportSections(report) {
  if (!report) return [];
  const blocks = report.split(/^##\s+/m).filter(Boolean);
  return blocks.map((block) => {
    const [titleLine, ...rest] = block.split('\n');
    return {
      title: titleLine.trim(),
      content: rest.join('\n').trim(),
    };
  }).filter((section) => section.title && section.content);
}

function getReportSections(preview) {
  if (preview.sections?.length) return preview.sections;
  return parseReportSections(preview.report);
}

function renderSectionContent(content) {
  const blocks = content.split(/\n\s*\n/).filter(Boolean);
  const isBulletList = blocks.length === 1 && blocks[0].includes('•');

  if (isBulletList) {
    const items = blocks[0].split('\n').map((line) => line.replace(/^•\s*/, '').trim()).filter(Boolean);
    return (
      <ul className="space-y-2 list-none">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm sm:text-base text-prune-800 leading-relaxed">
            <span className="text-topaz-500 font-bold shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return blocks.map((paragraph, index) => (
    <p key={index} className="text-sm sm:text-base text-prune-800 leading-relaxed">
      {paragraph}
    </p>
  ));
}

function ProjectReport({ preview }) {
  const sections = getReportSections(preview);
  const plainParagraphs = preview.report
    ? preview.report.split(/\n\s*\n/).filter(Boolean)
    : [];

  return (
    <article className="rounded-2xl border border-prune-100 bg-gradient-to-b from-white to-prune-50/40 overflow-hidden">
      <header className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-prune-100">
        <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
          Rapport de faisabilité
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl font-bold text-prune-900 leading-snug">
          {preview.quoi}
        </h2>
      </header>

      {sections.length > 0 ? (
        <div className="divide-y divide-prune-100">
          {sections.map((section, index) => (
            <section key={index} className="px-5 sm:px-8 py-5 sm:py-6">
              <h3 className="text-base sm:text-lg font-semibold text-prune-900 mb-3 sm:mb-4">
                {section.title}
              </h3>
              <div className="space-y-4">
                {renderSectionContent(section.content)}
              </div>
            </section>
          ))}
        </div>
      ) : plainParagraphs.length > 0 ? (
        <div className="px-5 sm:px-8 py-6 sm:py-8 space-y-5">
          {plainParagraphs.map((paragraph, index) => (
            <p key={index} className="text-sm sm:text-base text-prune-800 leading-relaxed whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <div className="px-5 sm:px-8 py-6 sm:py-8">
          <p className="text-sm text-prune-500 italic">
            Aucun rapport texte n&apos;a été renvoyé. Configurez le champ rapport dans vos prompts admin.
          </p>
        </div>
      )}

      <footer className="px-5 sm:px-8 py-4 sm:py-5 bg-prune-50/80 border-t border-prune-100">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">Lieu</dt>
            <dd className="mt-1 text-sm font-medium text-prune-900">{preview.ou}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">Budget estimé</dt>
            <dd className="mt-1 text-sm font-medium text-wasabi-700">
              {formatBudget(preview.budget, preview.currency)}
            </dd>
          </div>
        </dl>
      </footer>
    </article>
  );
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

  const sourceLabel = useMemo(() => {
    if (!preview) return '';
    if (preview.source === 'ai') return 'Complété par intelligence artificielle';
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

      <main className="page-container flex-1 py-6 sm:py-10 max-w-4xl">
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
          <ProjectReport preview={preview} />

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
                <Button type="button" onClick={handleUpgrade} disabled={submitting}>
                  {submitting ? 'Activation...' : 'Activer le compte payant'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-prune-600">
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

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { IconChevronRight, IconPath, IconRocket } from '../components/icons.jsx';
import { stageHref } from '../constants/projectStages.js';

const STEPS = [
  {
    id: 'idee',
    title: 'Informations générales',
    description: 'Retrouve toutes les informations définies lors de la recherche de projet.',
    cta: 'Consulter',
  },
  {
    id: 'etude_marche',
    title: 'Étude de marché',
    description: 'Suis les workflows, documents, contacts et dates clés de ton étude.',
    cta: 'Ouvrir',
  },
  {
    id: 'business_plan',
    title: 'Business plan',
    description: 'Structure ton modèle économique, ton prévisionnel et ton livrable BP.',
    cta: 'Ouvrir',
  },
  {
    id: 'financement',
    title: 'Financement',
    description: 'Cadre ton besoin, tes sources et ton dossier financeur.',
    cta: 'Ouvrir',
  },
  {
    id: 'immatriculation',
    title: 'Immatriculation',
    description: 'Choisis la forme, dépose le dossier et ouvre l’activité.',
    cta: 'Ouvrir',
  },
  {
    id: 'lancement',
    title: 'Lancement',
    description: 'Passe en live, trouve tes premiers clients et pilote le démarrage.',
    cta: 'Ouvrir',
  },
];

const STATUS_LABELS = {
  draft: 'Brouillon',
  active: 'En cours',
  paused: 'En pause',
  launched: 'Lancé',
  archived: 'Archivé',
};

export default function Parcours() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid } = useAuth();
  const {
    projects,
    currentProject,
    setCurrentProjectId,
    error: projectsError,
    refreshProjects,
  } = useProject();

  const openStep = (step) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/parcours' } });
      return;
    }
    if (!isPaid) {
      navigate('/projet/apercu');
      return;
    }
    if (!currentProject?.id && step.id !== 'idee') {
      navigate('/creer-son-avenir');
      return;
    }
    navigate(stageHref(step.id, currentProject?.id));
  };

  const selectProject = (project) => {
    setCurrentProjectId(project.id);
    navigate(`/projet/${project.id}`);
  };

  const projectName = currentProject
    ? (currentProject.title || currentProject.quoi || '').trim()
    : '';
  const currentStage = currentProject?.stage || 'idee';
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.id === currentStage)
  );

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        <header className="sticky top-0 z-10 header-glass">
          <div className="page-container py-4 sm:py-5">
            <BrandLogo size="sm" />
          </div>
        </header>

        <main className="page-container flex-1 space-y-6 sm:space-y-8 lg:space-y-10 max-w-[50.4rem] lg:max-w-[67.2rem]">
          <section className="pt-2 sm:pt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-prune-100 text-prune-700">
                <IconPath className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-prune-900 leading-tight">
                  Parcours
                </h1>
                {projectName && (
                  <p className="text-sm text-prune-600 truncate mt-0.5">{projectName}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-prune-600">
              Une colonne vertébrale : avance étape par étape sur ton projet courant.
            </p>
          </section>

          {projectsError && <p className="alert-error">{projectsError}</p>}

          <section className="space-y-3">
            {STEPS.map((step, index) => {
              const done = index < currentIndex;
              const current = index === currentIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => openStep(step)}
                  className={[
                    'w-full text-left rounded-2xl border p-4 sm:p-5 transition-colors',
                    current
                      ? 'border-wasabi-400 bg-wasabi-50/60'
                      : 'border-prune-100 bg-white hover:border-prune-300',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        'shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold',
                        done || current
                          ? 'bg-wasabi-500 text-white'
                          : 'bg-prune-100 text-prune-600',
                      ].join(' ')}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-bold text-prune-900">{step.title}</h2>
                        <span className="text-xs font-semibold text-topaz-600 flex items-center gap-0.5 shrink-0">
                          {step.cta}
                          <IconChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <p className="text-sm text-prune-600 mt-1">{step.description}</p>
                      {current && (
                        <p className="text-xs font-semibold text-wasabi-700 mt-2">Étape en cours</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          {isAuthenticated && isPaid && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold tracking-widest text-prune-600 uppercase">
                  Tes projets
                </h2>
                <button
                  type="button"
                  onClick={() => refreshProjects()}
                  className="text-xs font-semibold text-prune-500 hover:text-prune-800"
                >
                  Actualiser
                </button>
              </div>
              {projects.length === 0 ? (
                <Link
                  to="/creer-son-avenir"
                  className="card p-5 flex items-center gap-3 hover:border-prune-300 transition-colors"
                >
                  <IconRocket className="w-5 h-5 text-topaz-600" />
                  <span className="font-semibold text-prune-900">Créer un nouveau projet</span>
                </Link>
              ) : (
                <ul className="space-y-2">
                  {projects.map((p) => {
                    const active = Number(p.id) === Number(currentProject?.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => selectProject(p)}
                          className={[
                            'w-full text-left rounded-2xl border px-4 py-3 transition-colors',
                            active
                              ? 'border-prune-400 bg-prune-50'
                              : 'border-prune-100 bg-white hover:border-prune-300',
                          ].join(' ')}
                        >
                          <p className="font-semibold text-prune-900 truncate">
                            {p.title || p.quoi || `Projet #${p.id}`}
                          </p>
                          <p className="text-xs text-prune-500 mt-0.5">
                            {STATUS_LABELS[p.status] || p.status}
                            {active ? ' · projet courant' : ''}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <Link
                      to="/creer-son-avenir"
                      className="block text-sm font-semibold text-topaz-600 hover:text-topaz-500 px-1 py-2"
                    >
                      + Nouveau projet
                    </Link>
                  </li>
                </ul>
              )}
            </section>
          )}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

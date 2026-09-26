import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import MainLayout from '../components/MainLayout.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import { IconProjects, IconRocket } from '../components/icons.jsx';
import {
  clearProjectDraft,
  clearSearchProgress,
  clearSearchSeed,
  projectService,
} from '../services/projectService.js';

const STATUS_LABELS = {
  draft: 'Brouillon',
  active: 'En cours',
  paused: 'En pause',
  launched: 'Lancé',
  archived: 'Archivé',
};

function clearLocalProjectGuides(projectId) {
  try {
    const needle = `:${projectId}:`;
    for (const store of [localStorage, sessionStorage]) {
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (
          key &&
          (key.startsWith('kizumai_nextstep_seen') || key.startsWith('kizumai_advancement_cache')) &&
          key.includes(needle)
        ) {
          keys.push(key);
        }
      }
      keys.forEach((key) => store.removeItem(key));
    }
  } catch {
    // ignore
  }
}

export default function Projects() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid } = useAuth();
  const {
    projects,
    currentProject,
    setCurrentProjectId,
    error: projectsError,
    refreshProjects,
    loading,
    canCreateProject,
    projectCount,
    maxProjects,
  } = useProject();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const goCreate = () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/projets' } });
      return;
    }
    if (!isPaid) {
      navigate('/projet/apercu');
      return;
    }
    if (!canCreateProject) {
      return;
    }
    navigate('/creer-son-avenir');
  };

  const selectProject = (project) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/projets' } });
      return;
    }
    if (!isPaid) {
      navigate('/projet/apercu');
      return;
    }
    setCurrentProjectId(project.id);
    navigate('/');
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await projectService.deleteProject(deleteTarget.id);
      clearLocalProjectGuides(deleteTarget.id);
      clearProjectDraft();
      clearSearchSeed();
      clearSearchProgress();
      await refreshProjects();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message || 'Impossible de supprimer le projet');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-4 sm:py-5">
          <BrandLogo size="sm" />
        </div>
      </header>

      <main className="page-container flex-1 space-y-6 sm:space-y-8 lg:space-y-10 max-w-[50.4rem] lg:max-w-[67.2rem]">
        <section className="pt-2 sm:pt-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-prune-100 text-prune-700">
              <IconProjects className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-prune-900 leading-tight">
                Projets
              </h1>
              <p className="text-sm text-prune-600 mt-0.5">
                Jusqu’à {maxProjects} projets indépendants. Cliquez pour basculer sur un projet.
              </p>
            </div>
          </div>
        </section>

        {projectsError && <p className="alert-error">{projectsError}</p>}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold tracking-widest text-prune-600 uppercase">
              Vos projets
              {isAuthenticated && isPaid ? (
                <span className="ml-2 font-semibold normal-case tracking-normal text-prune-500">
                  ({projectCount}/{maxProjects})
                </span>
              ) : null}
            </h2>
            {isAuthenticated && isPaid && (
              <button
                type="button"
                onClick={() => refreshProjects()}
                className="text-xs font-semibold text-prune-500 hover:text-prune-800"
              >
                Actualiser
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="rounded-2xl border border-prune-100 bg-white p-5 space-y-3">
              <p className="text-sm text-prune-600">
                Connectez-vous pour voir et gérer vos projets.
              </p>
              <Button type="button" onClick={() => navigate('/login', { state: { from: '/projets' } })}>
                Se connecter
              </Button>
            </div>
          ) : !isPaid ? (
            <div className="rounded-2xl border border-prune-100 bg-white p-5 space-y-3">
              <p className="text-sm text-prune-600">
                Le suivi multi-projets est disponible avec un compte payant.
              </p>
              <Button type="button" onClick={() => navigate('/projet/apercu')}>
                Voir l’aperçu
              </Button>
            </div>
          ) : loading && projects.length === 0 ? (
            <p className="text-sm text-prune-500">Chargement des projets…</p>
          ) : projects.length === 0 ? (
            <button
              type="button"
              onClick={goCreate}
              className="card p-5 flex items-center gap-3 hover:border-prune-300 transition-colors w-full text-left"
            >
              <IconRocket className="w-5 h-5 text-topaz-600" />
              <span className="font-semibold text-prune-900">Créer mon premier projet</span>
            </button>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => {
                const active = Number(p.id) === Number(currentProject?.id);
                const label = p.title || p.quoi || `Projet #${p.id}`;
                return (
                  <li
                    key={p.id}
                    className={[
                      'rounded-2xl border px-4 py-3',
                      active ? 'border-prune-400 bg-prune-50' : 'border-prune-100 bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => selectProject(p)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-semibold text-prune-900 truncate">{label}</p>
                        <p className="text-xs text-prune-500 mt-0.5">
                          {STATUS_LABELS[p.status] || p.status}
                          {active ? ' · projet courant' : ' · basculer ici'}
                          {p.stage ? ` · ${p.stage}` : ''}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError('');
                          setDeleteTarget(p);
                        }}
                        className="shrink-0 text-xs font-semibold text-prune-500 hover:text-topaz-600 px-1 py-1"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                );
              })}
              <li>
                {canCreateProject ? (
                  <button
                    type="button"
                    onClick={goCreate}
                    className="block w-full text-left text-sm font-semibold text-topaz-600 hover:text-topaz-500 px-1 py-2"
                  >
                    + Nouveau projet
                  </button>
                ) : (
                  <p className="text-sm text-prune-500 px-1 py-2">
                    Limite de {maxProjects} projets atteinte. Supprimez un projet pour en créer un
                    autre.
                  </p>
                )}
              </li>
            </ul>
          )}
        </section>

        {isAuthenticated && isPaid && currentProject?.id && (
          <p className="text-sm text-prune-500">
            Projet actif :{' '}
            <Link to="/parcours" className="font-semibold text-topaz-600 hover:text-topaz-500">
              continuer le parcours
            </Link>
          </p>
        )}
      </main>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-prune-900/50"
            aria-label="Fermer"
            disabled={deleting}
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-topaz-600">
                Action irréversible
              </p>
              <h2 id="delete-project-title" className="text-lg font-bold text-prune-900 mt-1">
                Supprimer ce projet ?
              </h2>
              <p className="text-sm text-prune-600 mt-2 leading-relaxed">
                « {deleteTarget.title || deleteTarget.quoi || `Projet #${deleteTarget.id}`} » sera
                effacé définitivement, avec sa mémoire Fabulous, documents, étapes et données
                liées. Votre compte payant reste actif : vous pourrez recommencer un nouveau
                projet.
              </p>
            </div>
            {deleteError && <p className="alert-error">{deleteError}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Annuler
              </Button>
              <Button type="button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

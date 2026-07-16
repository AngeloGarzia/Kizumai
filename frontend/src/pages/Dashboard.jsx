import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import { projectService } from '../services/projectService.js';

const STATUS_LABELS = {
  draft: 'Brouillon',
  active: 'En cours',
  paused: 'En pause',
  launched: 'Lancé',
  archived: 'Archivé',
};

const STAGE_LABELS = {
  idee: 'Idée',
  etude_marche: 'Étude de marché',
  business_plan: 'Business plan',
  financement: 'Financement',
  immatriculation: 'Immatriculation',
  lancement: 'Lancement',
};

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState('');

  useEffect(() => {
    let active = true;
    projectService
      .getMine()
      .then((data) => {
        if (active) setProjects(data);
      })
      .catch((err) => {
        if (active) setProjectsError(err.message || 'Impossible de charger vos projets');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell onLogout={logout}>
      <div className="card p-5 sm:p-8">
        <div className="flex flex-col gap-1 sm:gap-2 mb-6 sm:mb-8">
          <p className="text-sm font-medium text-prune-600 uppercase tracking-wide">
            Tableau de bord
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-prune-900">
            Bienvenue, {user?.name}
          </h2>
          <p className="text-prune-600 text-sm sm:text-base">
            Vous êtes connecté à votre espace Kizumai.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="p-4 sm:p-5 bg-prune-50 rounded-xl border border-prune-100">
            <p className="text-xs font-semibold text-prune-500 uppercase tracking-wide">Email</p>
            <p className="text-prune-900 font-medium mt-1.5 break-all text-sm sm:text-base">
              {user?.email}
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-prune-50 rounded-xl border border-prune-100">
            <p className="text-xs font-semibold text-prune-500 uppercase tracking-wide">
              Membre depuis
            </p>
            <p className="text-prune-900 font-medium mt-1.5 text-sm sm:text-base">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-prune-50 rounded-xl border border-prune-100">
            <p className="text-xs font-semibold text-prune-500 uppercase tracking-wide">Rôle</p>
            <p className="text-prune-900 font-medium mt-1.5 text-sm sm:text-base">
              {user?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-prune-50 rounded-xl border border-prune-100">
            <p className="text-xs font-semibold text-prune-500 uppercase tracking-wide">Formule</p>
            <p className="text-prune-900 font-medium mt-1.5 text-sm sm:text-base">
              {user?.role === 'admin' || user?.plan === 'paid' ? 'Compte payant' : 'Compte gratuit'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/admin"
            className="mt-6 inline-flex items-center justify-center min-h-11 px-5 py-2.5 btn-primary w-auto"
          >
            Ouvrir l&apos;administration
          </Link>
        )}

        <section className="mt-6 sm:mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-prune-900">Mes projets</h3>
            <Link to="/creer-son-avenir" className="text-sm link-accent">+ Nouveau</Link>
          </div>

          {projectsError && <p className="alert-error">{projectsError}</p>}

          {projects.length === 0 ? (
            <p className="text-sm text-prune-500">
              Aucun projet enregistré. Lancez « Créer son avenir » pour démarrer.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projet/${project.id}`}
                    className="block p-4 rounded-xl border border-prune-100 bg-white hover:border-prune-300 transition-colors"
                  >
                    <p className="font-semibold text-prune-900 truncate">{project.title || project.quoi}</p>
                    <p className="text-sm text-prune-500 truncate">{project.location?.label || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-prune-100 text-prune-700 text-xs font-medium">
                        {STATUS_LABELS[project.status] || project.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-wasabi-100 text-wasabi-800 text-xs font-medium">
                        {STAGE_LABELS[project.stage] || project.stage}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NotificationSettings />

        <div className="mt-6 sm:mt-8 p-4 sm:p-5 rounded-xl bg-wasabi-50 border border-wasabi-200">
          <p className="text-sm text-prune-700">
            Interface optimisée pour mobile, tablette et ordinateur.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

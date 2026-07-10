import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();

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
            Vous êtes connecté à votre espace Myrokai.
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

        <div className="mt-6 sm:mt-8 p-4 sm:p-5 rounded-xl bg-wasabi-50 border border-wasabi-200">
          <p className="text-sm text-prune-700">
            Interface optimisée pour mobile, tablette et ordinateur.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

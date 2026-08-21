import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from './BrandLogo.jsx';

const IconSearch = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
  </svg>
);

const IconDashboard = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const IconCalendar = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
  </svg>
);

const IconAdmin = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
  </svg>
);

const NAV_LINKS = [
  { to: '/', label: 'Accueil', Icon: IconDashboard },
  { to: '/parcours', label: 'Parcours', Icon: IconSearch },
  { to: '/fil-du-temps', label: 'Fil du temps', Icon: IconDashboard },
  { to: '/ressources', label: 'Ressources', Icon: IconSearch },
  { to: '/planner', label: 'Agenda', Icon: IconCalendar },
  { to: '/admin', label: 'Administration', Icon: IconAdmin, adminOnly: true },
];

export default function AppShell({ children, onLogout }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const handleLogout = onLogout || logout;

  const links = NAV_LINKS.filter((link) => !link.adminOnly || isAdmin);

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-topaz-50 text-topaz-700'
        : 'text-prune-600 hover:text-prune-900 hover:bg-prune-50'
    }`;

  return (
    <div className="min-h-screen min-h-dvh page-bg">
      {/* Voile mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-prune-900/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu latéral */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-prune-100 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-prune-100">
          <BrandLogo size="sm" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-prune-500 hover:bg-prune-50"
            aria-label="Fermer le menu"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {links.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={navClass} onClick={() => setOpen(false)}>
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-prune-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-2 rounded-xl w-full text-left
                       hover:bg-prune-50 transition-colors"
            title="Déconnexion"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-prune-100 text-prune-700 shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path strokeLinecap="round" d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-prune-900 truncate">
                {user?.name || 'Utilisateur'}
              </span>
              <span className="block text-xs text-prune-500 truncate">
                {user?.email || 'Déconnexion'}
              </span>
            </span>
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="lg:pl-64 flex flex-col min-h-screen min-h-dvh">
        {/* Barre supérieure mobile avec burger */}
        <header className="lg:hidden sticky top-0 z-20 header-glass">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="p-2 -ml-2 rounded-lg text-prune-700 hover:bg-prune-50"
              aria-label="Ouvrir le menu"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <BrandLogo size="sm" />
            <span className="w-10" />
          </div>
        </header>

        <main className="flex-1 page-container py-5 sm:py-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

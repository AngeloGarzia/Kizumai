import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconHome,
  IconPath,
  IconBook,
  IconUser,
} from './icons.jsx';

function IconAdmin({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    </svg>
  );
}

function IconLogout({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function IconTimeline({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M8 8h8M6 12h12M9 16h6" />
    </svg>
  );
}

function IconAgenda({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path strokeLinecap="round" d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

const navItems = [
  { id: 'home', label: 'Accueil', icon: IconHome, path: '/' },
  { id: 'path', label: 'Parcours', icon: IconPath, path: '/parcours' },
  { id: 'timeline', label: 'Fil', icon: IconTimeline, path: '/fil-du-temps' },
  { id: 'resources', label: 'Ressources', icon: IconBook, path: '/ressources' },
  { id: 'agenda', label: 'Agenda', icon: IconAgenda, path: '/planner' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  const items = [
    ...navItems,
    ...(isAdmin
      ? [{ id: 'admin', label: 'Admin', icon: IconAdmin, path: '/admin' }]
      : []),
  ];

  const isItemActive = (item) => {
    if (item.id === 'home') return location.pathname === '/';
    if (item.id === 'path') {
      return (
        location.pathname === '/parcours' ||
        location.pathname.startsWith('/creer-son-avenir') ||
        location.pathname.startsWith('/projet')
      );
    }
    if (item.id === 'timeline') return location.pathname.startsWith('/fil-du-temps');
    if (item.id === 'resources') return location.pathname.startsWith('/ressources');
    if (item.id === 'agenda') return location.pathname.startsWith('/planner');
    if (item.id === 'admin') return location.pathname.startsWith('/admin');
    return location.pathname === item.path;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  const accountButtonClass = [
    'flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 sm:py-2 flex-1 lg:flex-none',
    'lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:rounded-xl lg:w-full',
    'transition-colors text-prune-500 hover:bg-prune-50 lg:hover:bg-prune-50',
  ].join(' ');

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 pb-safe
                 lg:static lg:pb-0 lg:h-screen lg:flex lg:flex-col
                 lg:border-r lg:border-prune-100 lg:bg-white lg:w-56 lg:shrink-0"
      aria-label="Navigation principale"
    >
      <div
        className="mx-3 mb-3 sm:mx-4 sm:mb-4 lg:mx-0 lg:mb-0 lg:p-4
                   bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-prune-900/10
                   border border-prune-100
                   lg:rounded-none lg:shadow-none lg:border-0
                   lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:h-full"
      >
        <ul className="flex items-stretch justify-around py-2 px-1 sm:py-3 lg:flex-col lg:gap-1 lg:p-0 overflow-x-auto">
          {items.map((item) => {
            const isActive = isItemActive(item);
            const Icon = item.icon;
            const hideLabelMobile = item.id === 'admin' || item.id === 'setup';

            return (
              <li key={item.id} className="flex-1 lg:flex-none min-w-[3.25rem]">
                <Link
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 sm:py-2
                              lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:rounded-xl lg:w-full
                              transition-colors
                              ${isActive
                    ? 'lg:bg-prune-900'
                    : 'hover:bg-prune-50 lg:hover:bg-prune-50'}`}
                >
                  <span
                    className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl
                                lg:w-9 lg:h-9 lg:rounded-xl transition-colors
                                ${isActive
                      ? 'bg-prune-900 text-wasabi-400 lg:bg-transparent'
                      : 'text-prune-500'}`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-medium lg:text-sm
                                ${hideLabelMobile ? 'hidden lg:inline' : ''}
                                ${isActive ? 'text-wasabi-500 lg:text-wasabi-400' : 'text-prune-500'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1 lg:hidden min-w-[3.25rem]">
            {isAuthenticated ? (
              <button type="button" onClick={handleLogout} className={accountButtonClass}>
                <span className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-prune-500">
                  <IconLogout className="w-5 h-5" />
                </span>
                <span className="text-xs sm:text-sm font-medium text-prune-500">Compte</span>
              </button>
            ) : (
              <Link to="/login" className={accountButtonClass}>
                <span className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-prune-500">
                  <IconUser className="w-5 h-5" />
                </span>
                <span className="text-xs sm:text-sm font-medium text-prune-500">Compte</span>
              </Link>
            )}
          </li>
        </ul>

        <div className="hidden lg:block mt-auto pt-4 border-t border-prune-100 shrink-0">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-xl w-full text-left
                         hover:bg-prune-50 transition-colors"
              title="Déconnexion"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-prune-100 text-prune-700 shrink-0">
                <IconUser className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-prune-900 truncate">
                  {user?.name || user?.email || 'Compte'}
                </span>
                <span className="block text-xs text-prune-500">
                  {isAdmin ? 'Administrateur · Déconnexion' : 'Déconnexion'}
                </span>
              </span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-3 px-3 py-2 rounded-xl w-full
                         hover:bg-prune-50 transition-colors"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-prune-100 text-prune-700 shrink-0">
                <IconUser className="w-5 h-5" />
              </span>
              <span className="text-sm font-medium text-prune-900">Connexion</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

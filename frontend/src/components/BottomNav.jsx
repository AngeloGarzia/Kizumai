import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconHome,
  IconPath,
  IconBook,
  IconMessage,
  IconUser,
} from './icons.jsx';

const navItems = [
  { id: 'home', label: 'Accueil', icon: IconHome, path: '/', auth: false },
  { id: 'path', label: 'Parcours', icon: IconPath, path: '/register', auth: true },
  { id: 'resources', label: 'Ressources', icon: IconBook, path: '/register', auth: true },
  { id: 'messages', label: 'Messages', icon: IconMessage, path: '/login', auth: true },
  { id: 'profile', label: 'Profil', icon: IconUser, path: '/login', auth: true },
];

export default function BottomNav() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const getPath = (item) => {
    if (item.id === 'home') return '/';
    if (item.id === 'profile') return isAuthenticated ? '/dashboard' : '/login';
    return isAuthenticated ? '/dashboard' : item.path;
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 pb-safe
                 lg:static lg:pb-0 lg:border-r lg:border-prune-100 lg:bg-white lg:min-h-screen lg:w-56 lg:shrink-0"
      aria-label="Navigation principale"
    >
      <div className="mx-3 mb-3 sm:mx-4 sm:mb-4 lg:mx-0 lg:mb-0 lg:p-4 lg:h-full
                      bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-prune-900/10
                      border border-prune-100
                      lg:rounded-none lg:shadow-none lg:border-0 lg:flex lg:flex-col lg:gap-1">
        <ul className="flex items-stretch justify-around py-2 px-1 sm:py-3 lg:flex-col lg:gap-1 lg:p-0">
          {navItems.map((item) => {
            const path = getPath(item);
            const isActive = item.id === 'home' && location.pathname === '/';
            const Icon = item.icon;

            return (
              <li key={item.id} className="flex-1 lg:flex-none">
                <Link
                  to={path}
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
                    className={`text-[10px] sm:text-xs font-medium lg:text-sm
                                ${isActive ? 'text-wasabi-500 lg:text-wasabi-400' : 'text-prune-500'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

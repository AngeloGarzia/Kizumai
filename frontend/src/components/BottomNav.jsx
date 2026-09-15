import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FabulousGuideModal from './FabulousGuideModal.jsx';
import { publicAssetUrl } from '../config/appBase.js';
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

function IconSetup({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
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

function IconFabulous({ className = 'w-5 h-5' }) {
  return (
    <img
      src={publicAssetUrl('fabulous.svg')}
      alt=""
      className={`${className} select-none`}
      decoding="async"
    />
  );
}

const navItems = [
  { id: 'home', label: 'Accueil', icon: IconHome, path: '/' },
  { id: 'path', label: 'Parcours', icon: IconPath, path: '/parcours' },
  { id: 'timeline', label: 'Fil', icon: IconTimeline, path: '/fil-du-temps' },
  { id: 'resources', label: 'Docs', icon: IconBook, path: '/ressources' },
  { id: 'agenda', label: 'Agenda', icon: IconAgenda, path: '/planner' },
];

const fabulousItem = {
  id: 'fabulous',
  type: 'fabulous',
  label: 'Fabulous',
  icon: IconFabulous,
};

export default function BottomNav() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [fabulousOpen, setFabulousOpen] = useState(false);

  // Setup : mobile uniquement (footer desktop). Admin : liste + mobile.
  const items = [
    ...navItems,
    ...(isAuthenticated
      ? [{ id: 'setup', label: 'Setup', icon: IconSetup, path: '/setup', mobileOnly: true }]
      : []),
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
    if (item.id === 'setup') return location.pathname.startsWith('/setup');
    if (item.id === 'admin') return location.pathname.startsWith('/admin');
    return location.pathname === item.path;
  };

  const setupLinkClass = [
    'flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 sm:py-2 flex-1 lg:flex-none',
    'lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:rounded-xl lg:w-full',
    'transition-colors text-prune-500 hover:bg-prune-50 lg:hover:bg-prune-50',
  ].join(' ');

  const renderNavLink = (item) => {
    const isActive = isItemActive(item);
    const Icon = item.icon;
    const hideLabelMobile = item.id === 'admin';

    return (
      <li
        key={item.id}
        className={`flex-1 lg:flex-none min-w-[3.25rem]${item.mobileOnly ? ' lg:hidden' : ''}`}
      >
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
  };

  const renderFabulousButton = () => {
    const Icon = fabulousItem.icon;
    const isActive = fabulousOpen;

    return (
      <li key={fabulousItem.id} className="flex-1 lg:flex-none min-w-[3.25rem]">
        <button
          type="button"
          onClick={() => setFabulousOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 sm:py-2 w-full
                      lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:rounded-xl
                      transition-colors
                      ${isActive
            ? 'lg:bg-prune-900'
            : 'hover:bg-prune-50 lg:hover:bg-prune-50'}`}
          aria-label="Ouvrir le guide Fabulous pour cette page"
        >
          <span
            className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl
                        lg:w-9 lg:h-9 lg:rounded-xl transition-colors
                        ${isActive
              ? 'bg-prune-900 lg:bg-transparent ring-2 ring-wasabi-400/80'
              : 'text-prune-500 bg-wasabi-50/60'}`}
          >
            <Icon className="w-5 h-5" />
          </span>
          <span
            className={`text-xs sm:text-sm font-medium lg:text-sm
                        ${isActive ? 'text-wasabi-500 lg:text-wasabi-400' : 'text-prune-500'}`}
          >
            {fabulousItem.label}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
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
            {items.flatMap((item, index) => {
              const nodes = [renderNavLink(item)];
              if (index === 0) nodes.push(renderFabulousButton());
              return nodes;
            })}

            {!isAuthenticated && (
              <li className="flex-1 lg:hidden min-w-[3.25rem]">
                <Link to="/login" className={setupLinkClass}>
                  <span className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-prune-500">
                    <IconUser className="w-5 h-5" />
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-prune-500">Compte</span>
                </Link>
              </li>
            )}
          </ul>

          <div className="hidden lg:block mt-auto pt-4 border-t border-prune-100 shrink-0">
            {isAuthenticated ? (
              <Link
                to="/setup"
                className={`flex items-center gap-3 px-3 py-2 rounded-xl w-full transition-colors ${
                  location.pathname.startsWith('/setup')
                    ? 'bg-prune-900 text-wasabi-400'
                    : 'hover:bg-prune-50'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                    location.pathname.startsWith('/setup')
                      ? 'bg-prune-800 text-wasabi-400'
                      : 'bg-prune-100 text-prune-700'
                  }`}
                >
                  <IconSetup className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium truncate ${
                      location.pathname.startsWith('/setup') ? 'text-wasabi-400' : 'text-prune-900'
                    }`}
                  >
                    {user?.name || user?.email || 'Setup'}
                  </span>
                  <span
                    className={`block text-xs truncate ${
                      location.pathname.startsWith('/setup') ? 'text-wasabi-400/80' : 'text-prune-500'
                    }`}
                  >
                    Setup · {isAdmin ? 'Administrateur' : 'Mon compte'}
                  </span>
                </span>
              </Link>
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

      <FabulousGuideModal open={fabulousOpen} onClose={() => setFabulousOpen(false)} />
    </>
  );
}

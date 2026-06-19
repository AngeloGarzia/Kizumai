import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import ModulesSection from '../components/ModulesSection.jsx';
import { IconRocket, IconChevronRight } from '../components/icons.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  const goToCreateFuture = () => navigate('/creer-son-avenir');
  const goToAuth = () => navigate(isAuthenticated ? '/dashboard' : '/register');

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      {/* Navigation latérale sur desktop */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        {/* Header */}
        <header className="sticky top-0 z-10 header-glass">
          <div className="page-container py-4 sm:py-5 flex items-center justify-between">
            <div className="w-10 lg:hidden" aria-hidden="true" />
            <BrandLogo size="md" className="mx-auto lg:mx-0" />
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-prune-900 text-wasabi-400 shrink-0
                         hover:bg-prune-800 transition-colors"
              aria-label={isAuthenticated ? 'Mon profil' : 'Se connecter'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="8" r="4" />
                <path strokeLinecap="round" d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
              </svg>
            </Link>
          </div>
        </header>

        <main className="page-container flex-1 space-y-6 sm:space-y-8 lg:space-y-10 max-w-2xl lg:max-w-4xl">
          {/* Accueil */}
          <section className="text-center lg:text-left">
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-topaz-600 uppercase">
              Bonjour ! 👋
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold text-prune-900 leading-tight">
              Bienvenue dans ton parcours{' '}
              <span className="relative inline-block text-wasabi-600">
                entrepreneurial
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-wasabi-300/60 rounded-full" />
              </span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-prune-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Chaque grand voyage commence par une première étape. Prêt à transformer tes idées en réalité ?
            </p>
          </section>

          {/* Carte progression + surimpression */}
          <ProgressCard
            showOverlay={!loading && !isAuthenticated}
            onCreateFuture={goToCreateFuture}
          />

          {/* Modules */}
          <ModulesSection
            locked={!isAuthenticated}
            onModuleClick={goToAuth}
            onViewAll={goToAuth}
          />

          {/* CTA principal */}
          <button
            type="button"
            onClick={goToAuth}
            className="btn-cta w-full"
          >
            <IconRocket className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-center">Démarrer ma journée</span>
            <IconChevronRight className="w-5 h-5 shrink-0 opacity-80" />
          </button>
        </main>
      </div>

      {/* Bottom nav mobile / tablette */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

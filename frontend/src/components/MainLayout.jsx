import BottomNav from './BottomNav.jsx';

/**
 * Shell principal unifié : sidebar BottomNav (desktop) + barre basse (mobile).
 */
export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:self-start lg:shrink-0">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        {children}
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

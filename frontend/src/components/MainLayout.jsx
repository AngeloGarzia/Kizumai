import { useState } from 'react';
import BottomNav from './BottomNav.jsx';
import FabulousGuideModal from './FabulousGuideModal.jsx';

/**
 * Shell principal unifié : sidebar BottomNav (desktop) + barre basse (mobile).
 * Une seule modale Fabulous (portail body) partagée par les deux instances de nav.
 */
export default function MainLayout({ children }) {
  const [fabulousOpen, setFabulousOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:self-start lg:shrink-0">
        <BottomNav
          fabulousOpen={fabulousOpen}
          onFabulousOpen={() => setFabulousOpen(true)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        {children}
      </div>

      <div className="lg:hidden">
        <BottomNav
          fabulousOpen={fabulousOpen}
          onFabulousOpen={() => setFabulousOpen(true)}
        />
      </div>

      <FabulousGuideModal open={fabulousOpen} onClose={() => setFabulousOpen(false)} />
    </div>
  );
}

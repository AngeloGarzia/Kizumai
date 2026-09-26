import { useState } from 'react';
import BottomNav from './BottomNav.jsx';
import FabulousFab from './FabulousFab.jsx';
import FabulousGuideModal from './FabulousGuideModal.jsx';

/**
 * Shell principal unifié : sidebar BottomNav (desktop) + barre basse (mobile).
 * Fabulous est un FAB flottant (hors nav) + une seule modale partagée.
 */
export default function MainLayout({ children }) {
  const [fabulousOpen, setFabulousOpen] = useState(false);

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

      <FabulousFab open={fabulousOpen} onOpen={() => setFabulousOpen(true)} />
      <FabulousGuideModal open={fabulousOpen} onClose={() => setFabulousOpen(false)} />
    </div>
  );
}

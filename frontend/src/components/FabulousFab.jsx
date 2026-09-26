import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { ASSISTANT_NAME } from '../constants/assistant.js';
import { publicAssetUrl } from '../config/appBase.js';

const NO_PROJECT_HINT = 'Créez d’abord un projet pour accéder à Fabulous';

/**
 * Bouton flottant Fabulous — guide contextuel de page.
 * Masqué si non connecté ou si la modale est ouverte.
 */
export default function FabulousFab({ open = false, onOpen }) {
  const { isAuthenticated } = useAuth();
  const { hasProject, loading: projectsLoading } = useProject();

  if (!isAuthenticated || open) return null;

  const locked = !projectsLoading && !hasProject;
  const label = locked ? NO_PROJECT_HINT : `Ouvrir le guide ${ASSISTANT_NAME} pour cette page`;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => {
        if (locked) return;
        onOpen?.();
      }}
      title={label}
      aria-label={label}
      className={[
        'fixed z-[60] flex items-center gap-2 rounded-full',
        'right-4 sm:right-6',
        /* Au-dessus de la bottom nav mobile + safe area */
        'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]',
        'lg:bottom-8 lg:right-8',
        'pl-2.5 pr-3.5 py-2 sm:pl-3 sm:pr-4 sm:py-2.5',
        'shadow-lg shadow-prune-900/20 border transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wasabi-400 focus-visible:ring-offset-2',
        locked
          ? 'cursor-not-allowed opacity-55 bg-prune-100 border-prune-200 text-prune-400'
          : 'bg-white border-wasabi-200/80 text-prune-800 hover:shadow-xl hover:border-wasabi-300 hover:scale-[1.02] active:scale-[0.98]',
      ].join(' ')}
    >
      <img
        src={publicAssetUrl('fabulous.svg')}
        alt=""
        width={36}
        height={36}
        className={[
          'h-9 w-9 sm:h-10 sm:w-10 shrink-0 select-none rounded-full',
          locked ? 'opacity-50 grayscale' : '',
        ].join(' ')}
        decoding="async"
      />
      <span
        className={[
          'text-sm font-semibold tracking-wide',
          locked ? 'text-prune-400' : 'text-prune-900',
        ].join(' ')}
      >
        {ASSISTANT_NAME}
      </span>
    </button>
  );
}

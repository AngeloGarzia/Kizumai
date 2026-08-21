import { PROJECT_STAGES } from '../constants/projectStages.js';

function ProgressRing({ percent = 0 }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.min(100, Math.max(0, Number(percent) || 0));
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a8c82a" />
            <stop offset="100%" stopColor="#c0db6a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-xl sm:text-2xl font-bold">{safe}%</span>
        <span className="text-xs sm:text-sm text-prune-300">Complétée</span>
      </div>
    </div>
  );
}

function Timeline({ steps = [] }) {
  const items = steps.length
    ? steps
    : PROJECT_STAGES.map((s) => ({ id: s.id, label: s.short, status: 'upcoming' }));

  return (
    <div className="flex items-center justify-between gap-1 mt-4 sm:mt-5">
      {items.map((step, index) => (
        <div key={step.id || step.label} className="flex flex-col items-center flex-1 min-w-0">
          <div className="flex items-center w-full">
            {index > 0 && (
              <div className={`h-0.5 flex-1 ${step.status === 'upcoming' ? 'bg-white/20' : 'bg-wasabi-400'}`} />
            )}
            <div
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full shrink-0 flex items-center justify-center
                ${step.status === 'done' ? 'bg-wasabi-400' : ''}
                ${step.status === 'current' ? 'bg-wasabi-400 ring-2 ring-wasabi-300/50' : ''}
                ${step.status === 'upcoming' ? 'bg-white/25' : ''}`}
            >
              {step.status === 'done' && (
                <svg className="w-2 h-2 text-prune-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {index < items.length - 1 && (
              <div className={`h-0.5 flex-1 ${items[index + 1].status === 'upcoming' ? 'bg-white/20' : 'bg-wasabi-400'}`} />
            )}
          </div>
          <span
            className={`text-[10px] sm:text-xs mt-1.5 truncate w-full text-center
            ${step.status === 'upcoming' ? 'text-white/40' : 'text-white/80'}
            ${step.status === 'current' ? 'font-semibold text-wasabi-300' : ''}`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProgressCard({
  showOverlay = true,
  onCreateFuture,
  project = null,
  onOpenNext,
}) {
  const title = project?.title || project?.quoi || null;
  const progress = project?.progress;
  const percent = progress?.percent ?? 0;
  const steps = progress?.steps || [];
  const nextLabel = progress?.nextLabel || 'Commencer le parcours';
  const subtitle = title
    ? progress?.currentLabel
      ? `${progress.currentLabel}`
      : 'Continue, tu es sur la bonne voie !'
    : 'Crée ton projet pour suivre ta progression.';

  return (
    <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-prune-900 via-prune-800 to-prune-950 p-4 sm:p-5 lg:p-6 shadow-xl shadow-prune-900/20">
      <div className={showOverlay ? 'blur-[2px] opacity-60 pointer-events-none select-none' : ''}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 text-wasabi-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-4 4 4 8-10" />
              </svg>
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-widest text-prune-300 uppercase truncate">
              {title || 'Mon projet'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 sm:mt-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Ta progression</h2>
            <p className="text-xs sm:text-sm text-prune-300 mt-1 truncate">{subtitle}</p>
          </div>
          <ProgressRing percent={percent} />
        </div>

        <Timeline steps={steps} />

        <button
          type="button"
          onClick={onOpenNext}
          disabled={!onOpenNext}
          className="mt-4 sm:mt-5 flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/25 border border-white/10 w-full text-left hover:bg-black/35 transition-colors disabled:pointer-events-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-wasabi-400 shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="8" width="18" height="13" rx="2" />
                <path d="M12 8v13M3 12h18" />
              </svg>
            </span>
            <p className="text-xs sm:text-sm text-white/90 truncate">
              Prochaine étape : <strong className="text-wasabi-400">{nextLabel}</strong>
            </p>
          </div>
          <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-prune-950/40 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={onCreateFuture}
            className="btn-cta-overlay shadow-2xl shadow-topaz-500/40 animate-pulse hover:animate-none"
          >
            Créer son avenir
          </button>
        </div>
      )}
    </section>
  );
}

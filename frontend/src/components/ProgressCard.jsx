function ProgressRing({ percent = 65 }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

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
        <span className="text-xl sm:text-2xl font-bold">{percent}%</span>
        <span className="text-[10px] sm:text-xs text-prune-300">Complété</span>
      </div>
    </div>
  );
}

function Timeline() {
  const steps = [
    { label: 'Démarré', status: 'done' },
    { label: 'En cours', status: 'current' },
    { label: 'À venir', status: 'upcoming' },
  ];

  return (
    <div className="flex items-center justify-between gap-2 mt-4 sm:mt-5">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-col items-center flex-1 min-w-0">
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
            {index < steps.length - 1 && (
              <div className={`h-0.5 flex-1 ${steps[index + 1].status === 'upcoming' ? 'bg-white/20' : 'bg-wasabi-400'}`} />
            )}
          </div>
          <span className={`text-[10px] sm:text-xs mt-1.5 truncate w-full text-center
            ${step.status === 'upcoming' ? 'text-white/40' : 'text-white/80'}`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProgressCard({ showOverlay = true, onCreateFuture }) {
  return (
    <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-prune-900 via-prune-800 to-prune-950 p-4 sm:p-5 lg:p-6 shadow-xl shadow-prune-900/20">
      {/* Contenu de progression */}
      <div className={showOverlay ? 'blur-[2px] opacity-60 pointer-events-none select-none' : ''}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 text-wasabi-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-4 4 4 8-10" />
              </svg>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold tracking-widest text-prune-300 uppercase">
              Mon projet
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 sm:mt-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Ta progression</h2>
            <p className="text-xs sm:text-sm text-prune-300 mt-1">Continue, tu es sur la bonne voie !</p>
          </div>
          <ProgressRing percent={65} />
        </div>

        <Timeline />

        <div className="mt-4 sm:mt-5 flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/25 border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-wasabi-400 shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="8" width="18" height="13" rx="2" />
                <path d="M12 8v13M3 12h18" />
              </svg>
            </span>
            <p className="text-xs sm:text-sm text-white/90 truncate">
              Prochaine étape : <strong className="text-wasabi-400">Lieu stratégique</strong>
            </p>
          </div>
          <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Surimpression — Créer son avenir */}
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

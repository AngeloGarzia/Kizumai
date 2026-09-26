import FabulousThinking from './FabulousThinking.jsx';
import { ASSISTANT_NAME, assistantPhrases } from '../constants/assistant.js';

const FORMAT_LABEL = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  mixte: 'Mixte',
};

function RefineBar({ placeholder, value, onChange, onSubmit, disabled }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <input
        type="text"
        className="input-field flex-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" className="btn-primary shrink-0" disabled={disabled}>
        Affiner
      </button>
    </form>
  );
}

/**
 * Modal Fabulous : suggestions de formations (création ou projet existant).
 */
export default function TrainingAssistModal({
  businessTitle,
  region = '',
  onRegionChange,
  showRegion = false,
  trainings = [],
  loading = false,
  error = '',
  refine = '',
  onRefineChange,
  onRefine,
  onSearch,
  savedTitle = null,
  onSave,
  saveLabel = 'Mettre de côté',
  savedLabel = 'Formation enregistrée ✓',
  onClose,
  closeLabel = 'Fermer',
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
              {ASSISTANT_NAME} · formations
            </p>
            <h2 id="training-modal-title" className="text-lg font-bold text-prune-900 mt-1">
              Formations pour « {businessTitle} »
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-prune-500 hover:bg-prune-50"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {showRegion && (
          <div className="mb-4 space-y-2">
            <label className="label-field" htmlFor="training-region">
              Région / zone de recherche
            </label>
            <div className="flex gap-2">
              <input
                id="training-region"
                type="text"
                className="input-field flex-1"
                placeholder="Ex : Lyon, Bretagne, Dakar…"
                value={region}
                onChange={(e) => onRegionChange?.(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                disabled={loading || !String(region || '').trim()}
                onClick={() => onSearch?.()}
              >
                Chercher
              </button>
            </div>
          </div>
        )}

        {error && <p className="alert-error mb-3">{error}</p>}

        {loading ? (
          <FabulousThinking message={assistantPhrases.preparingTrainings} />
        ) : trainings.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-prune-500 mb-4">
            {showRegion
              ? 'Indiquez une région puis lancez la recherche Fabulous.'
              : 'Aucune formation pour le moment. Affinez ou réessayez.'}
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {trainings.map((training, index) => {
              const saved = savedTitle === training.title;
              return (
                <div
                  key={index}
                  className={[
                    'rounded-2xl border p-4',
                    saved ? 'border-wasabi-400 bg-wasabi-50/50' : 'border-prune-100',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-prune-900">{training.title}</h3>
                    {training.level && (
                      <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-prune-100 text-prune-700">
                        {training.level}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-prune-500 mt-1">
                    {training.duration || training.durationLabel || 'Durée à préciser'}
                    {' · '}
                    {FORMAT_LABEL[training.format] || training.format || 'Format mixte'}
                  </p>
                  {(training.rationale || training.description) && (
                    <p className="text-sm text-prune-600 mt-2">
                      {training.rationale || training.description}
                    </p>
                  )}
                  {training.skills?.length > 0 && (
                    <p className="text-xs text-prune-500 mt-2">
                      Compétences : {training.skills.join(', ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onSave?.(training)}
                    className="mt-3 text-xs font-semibold text-wasabi-700 hover:underline"
                  >
                    {saved ? savedLabel : saveLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <RefineBar
          placeholder="Ex : plutôt courte, certifiante, gestion…"
          value={refine}
          onChange={onRefineChange}
          onSubmit={onRefine}
          disabled={loading || (showRegion && !trainings.length && !error)}
        />

        <button type="button" onClick={onClose} className="btn-secondary w-full mt-4">
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

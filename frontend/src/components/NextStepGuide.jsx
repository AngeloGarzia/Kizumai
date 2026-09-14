import Button from './Button.jsx';

/**
 * Popup de rappel « prochaine étape » sur le dashboard (IA ou fallback).
 */
export default function NextStepGuide({ open, guide, onDismiss, onContinue }) {
  if (!open || !guide) return null;

  const secondary = Array.isArray(guide.secondary) ? guide.secondary : [];
  const keyFacts = Array.isArray(guide.keyFacts) ? guide.keyFacts : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="next-step-guide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={onDismiss}
      />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-wasabi-700">
            {guide.eyebrow}
          </p>
          <h2 id="next-step-guide-title" className="text-lg font-bold text-prune-900 mt-1">
            {guide.title}
          </h2>
          <p className="text-sm text-prune-600 mt-2 leading-relaxed whitespace-pre-line">
            {guide.body}
          </p>
        </div>

        {keyFacts.length > 0 && (
          <ul className="space-y-1.5 text-sm text-prune-700">
            {keyFacts.slice(0, 3).map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-wasabi-600 shrink-0" aria-hidden>
                  ·
                </span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        )}

        {secondary.length > 0 && (
          <div className="rounded-2xl bg-prune-50 px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
              Aussi utile
            </p>
            <ul className="space-y-1 text-sm text-prune-700">
              {secondary.map((item) => (
                <li key={item.text || item}>{item.text || item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onDismiss}>
            Plus tard
          </Button>
          <Button type="button" onClick={onContinue}>
            {guide.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';

/**
 * Popup détail calcul / explication d’une pastille métrique.
 */
export default function MetricPillDetailModal({ detail, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!detail) return undefined;
    closeRef.current?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="metric-pill-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/45"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4 max-h-[88dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
              {detail.eyebrow}
            </p>
            <h2
              id="metric-pill-detail-title"
              className="text-lg font-bold text-prune-900 mt-1"
            >
              {detail.title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-prune-700">{detail.headline}</p>
            {detail.scoreLabel && (
              <p className="mt-0.5 text-xs tabular-nums text-prune-400">{detail.scoreLabel}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1 text-sm text-prune-500 hover:bg-prune-50 hover:text-prune-800"
          >
            Fermer
          </button>
        </div>

        {detail.summary && (
          <p className="text-sm text-prune-700 leading-relaxed">{detail.summary}</p>
        )}

        {Array.isArray(detail.calcSteps) && detail.calcSteps.length > 0 && (
          <div className="rounded-2xl border border-prune-100 bg-prune-50/60 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-prune-900">{detail.calcTitle}</h3>
            <ol className="list-decimal pl-4 space-y-1.5">
              {detail.calcSteps.map((step, i) => (
                <li key={i} className="text-sm text-prune-700 leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {detail.meaning && (
          <div>
            <h3 className="text-sm font-semibold text-prune-900 mb-1.5">
              {detail.meaningTitle}
            </h3>
            <p className="text-sm text-prune-700 leading-relaxed">{detail.meaning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

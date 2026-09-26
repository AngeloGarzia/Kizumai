import { useEffect, useRef } from 'react';

/**
 * Popup d’explication métier d’une pastille (concurrence / rentabilité / faisabilité).
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

  const points = Array.isArray(detail.explainPoints)
    ? detail.explainPoints.filter(Boolean)
    : Array.isArray(detail.calcSteps)
      ? detail.calcSteps.filter(Boolean)
      : [];
  const pointsTitle = detail.explainTitle || detail.calcTitle || 'Explication';

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

        {points.length > 0 && (
          <div className="rounded-2xl border border-prune-100 bg-prune-50/60 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-prune-900">{pointsTitle}</h3>
            <ul className="space-y-2">
              {points.map((step, i) => (
                <li key={i} className="text-sm text-prune-700 leading-relaxed pl-3 border-l-2 border-topaz-300">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.meaning && (
          <div>
            <h3 className="text-sm font-semibold text-prune-900 mb-1.5">
              {detail.meaningTitle || 'En pratique'}
            </h3>
            <p className="text-sm text-prune-700 leading-relaxed">{detail.meaning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

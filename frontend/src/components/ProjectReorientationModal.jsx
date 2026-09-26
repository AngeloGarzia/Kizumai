import { useEffect, useMemo, useState } from 'react';
import { projectService } from '../services/projectService.js';
import { assistantPhrases } from '../constants/assistant.js';
import FabulousThinking from './FabulousThinking.jsx';

const FIELD_ORDER = {
  business: 0,
  location: 1,
  budget: 2,
  title: 3,
  description: 4,
};

/**
 * Modal de propositions de réorientation après analyse IA de l'état projet.
 */
export default function ProjectReorientationModal({
  projectId,
  reviewId: initialReviewId,
  onClose,
  onApplied,
}) {
  const [reviewId, setReviewId] = useState(initialReviewId);
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const status = payload?.review?.status;
  const suggested = useMemo(() => {
    const list = (payload?.items || []).filter((i) => i.status === 'suggested');
    return [...list].sort(
      (a, b) => (FIELD_ORDER[a.fieldKey] ?? 9) - (FIELD_ORDER[b.fieldKey] ?? 9)
    );
  }, [payload]);

  useEffect(() => {
    setReviewId(initialReviewId);
  }, [initialReviewId]);

  useEffect(() => {
    if (!projectId || !reviewId) return undefined;
    let active = true;
    let timer;

    const poll = async () => {
      try {
        const data = await projectService.getProjectReview(projectId, reviewId);
        if (!active) return;
        setPayload(data);
        setError('');
        const st = data?.review?.status;
        if (st === 'pending' || st === 'processing') {
          timer = setTimeout(poll, 1800);
          return;
        }
        if (st === 'ready') {
          const ids = (data.items || [])
            .filter((i) => i.status === 'suggested')
            .map((i) => i.id);
          setSelected(new Set(ids));
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Impossible de récupérer l’analyse');
        timer = setTimeout(poll, 2500);
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, reviewId]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    if (!reviewId) return;
    setBusy(true);
    setError('');
    try {
      const acceptItemIds = suggested.filter((i) => selected.has(i.id)).map((i) => i.id);
      const rejectItemIds = suggested.filter((i) => !selected.has(i.id)).map((i) => i.id);
      const result = await projectService.applyProjectReview(projectId, reviewId, {
        acceptItemIds,
        rejectItemIds,
      });
      onApplied?.(result);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Application impossible');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (!reviewId) {
      onClose?.();
      return;
    }
    setBusy(true);
    try {
      await projectService.dismissProjectReview(projectId, reviewId);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Fermeture impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-topaz-600">
              {assistantPhrases.scan || 'Fabulous'}
            </p>
            <h2 id="project-review-title" className="text-lg font-bold text-prune-900 mt-0.5">
              Réorientation du projet
            </h2>
            {status === 'ready' && (
              <p className="text-sm text-prune-600 mt-1">
                Fabulous a relu l’ensemble des données en base. Validez les changements proposés.
              </p>
            )}
          </div>
          <button
            type="button"
            className="text-prune-500 hover:text-prune-800 text-sm font-medium"
            onClick={dismiss}
            disabled={busy}
          >
            Plus tard
          </button>
        </div>

        {(status === 'pending' || status === 'processing' || !payload) && (
          <FabulousThinking
            message="Fabulous analyse l’état complet de votre projet…"
            className="py-6"
          />
        )}

        {status === 'failed' && (
          <div className="space-y-4">
            <p className="text-sm text-prune-700 bg-prune-50 rounded-xl p-3">
              {payload?.review?.errorMessage || 'Analyse impossible pour le moment.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={dismiss} disabled={busy}>
                Fermer
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-4">
            {payload?.review?.situation && (
              <p className="text-sm text-prune-700 bg-prune-50 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                {payload.review.situation}
              </p>
            )}

            {suggested.length === 0 ? (
              <p className="text-sm text-prune-600 py-2">
                Aucune réorientation nécessaire : le business, le lieu et le budget restent cohérents
                avec les données actuelles.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggested.map((item) => (
                  <li key={item.id}>
                    <label className="flex gap-3 items-start rounded-xl border border-prune-100 p-3 cursor-pointer hover:border-prune-300">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-prune-500">
                            {item.label || item.fieldKey}
                          </span>
                          {item.priority === 'high' && (
                            <span className="text-xs font-medium text-amber-700">prioritaire</span>
                          )}
                        </span>
                        {item.currentValue && (
                          <span className="block text-xs text-prune-500 mt-1">
                            Actuel : {item.currentValue}
                          </span>
                        )}
                        <span className="block font-semibold text-prune-900 mt-0.5">
                          → {item.proposedValue}
                        </span>
                        {item.rationale && (
                          <span className="block text-sm text-prune-600 mt-1 leading-relaxed">
                            {item.rationale}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <button type="button" className="btn-secondary" onClick={dismiss} disabled={busy}>
                {suggested.length ? 'Tout ignorer' : 'Fermer'}
              </button>
              {suggested.length > 0 && (
                <button type="button" className="btn-primary" onClick={apply} disabled={busy}>
                  {busy
                    ? 'Enregistrement…'
                    : `Appliquer (${[...selected].length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {error && status !== 'ready' && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}

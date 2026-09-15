import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import Button from './Button.jsx';
import FabulousThinking from './FabulousThinking.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { ASSISTANT_NAME, assistantPhrases } from '../constants/assistant.js';
import { projectService } from '../services/projectService.js';
import { buildPageGuidePayload } from '../utils/pageGuideContext.js';
import { publicAssetUrl } from '../config/appBase.js';

export default function FabulousGuideModal({ open, onClose }) {
  const location = useLocation();
  const { currentProject } = useProject();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setGuide(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setGuide(null);

    const payload = buildPageGuidePayload(location, { project: currentProject });

    projectService
      .fetchFabulousPageGuide(payload)
      .then((result) => {
        if (!cancelled) setGuide(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Impossible de charger le guide.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, location.pathname, location.search, currentProject?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const steps = Array.isArray(guide?.steps) ? guide.steps : [];
  const context = buildPageGuidePayload(location, { project: currentProject });

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fabulous-guide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <img
            src={publicAssetUrl('fabulous.svg')}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 select-none"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-wasabi-700">
              {ASSISTANT_NAME}
            </p>
            <p className="text-xs text-prune-500 mt-0.5">
              {context.pageLabel} · {context.sectionLabel}
            </p>
          </div>
        </div>

        {loading && (
          <FabulousThinking message={assistantPhrases.pageGuide} size="sm" className="py-8" />
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && guide && (
          <>
            <div>
              <h2 id="fabulous-guide-title" className="text-lg font-bold text-prune-900">
                {guide.title}
              </h2>
              {guide.summary ? (
                <p className="text-sm text-prune-600 mt-2 leading-relaxed">{guide.summary}</p>
              ) : null}
            </div>

            {steps.length > 0 && (
              <ol className="space-y-2.5 list-none">
                {steps.map((step, index) => (
                  <li
                    key={`${index}-${step.slice(0, 40)}`}
                    className="flex gap-3 text-sm text-prune-800"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wasabi-100 text-xs font-bold text-wasabi-800">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {guide.tip ? (
              <div className="rounded-2xl bg-prune-50 px-4 py-3 text-sm text-prune-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-prune-500 mb-1">
                  Astuce
                </p>
                <p>{guide.tip}</p>
              </div>
            ) : null}
          </>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

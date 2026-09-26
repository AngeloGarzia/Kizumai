import { useEffect, useMemo, useRef, useState } from 'react';
import { projectService } from '../services/projectService.js';
import { assistantPhrases } from '../constants/assistant.js';
import FabulousThinking from './FabulousThinking.jsx';

/**
 * Modal d’audit expert Fabulous (viabilité / rentabilité + propositions).
 */
export default function ProjectAuditModal({
  projectId,
  auditId: initialAuditId,
  onClose,
  onApplied,
}) {
  const [auditId, setAuditId] = useState(initialAuditId);
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const closeBtnRef = useRef(null);
  const pollFailsRef = useRef(0);

  const status = payload?.audit?.status;
  const suggested = useMemo(
    () => (payload?.items || []).filter((i) => i.status === 'suggested'),
    [payload]
  );

  useEffect(() => {
    setAuditId(initialAuditId);
  }, [initialAuditId]);

  useEffect(() => {
    closeBtnRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  useEffect(() => {
    if (!projectId || !auditId) return undefined;
    let active = true;
    let timer;
    pollFailsRef.current = 0;

    const poll = async () => {
      try {
        const data = await projectService.getProjectAudit(projectId, auditId);
        if (!active) return;
        setPayload(data);
        setError('');
        pollFailsRef.current = 0;
        const st = data?.audit?.status;
        if (st === 'pending' || st === 'processing') {
          timer = setTimeout(poll, 1800);
          return;
        }
        if (st === 'ready') {
          setSelected(
            new Set((data.items || []).filter((i) => i.status === 'suggested').map((i) => i.id))
          );
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Impossible de récupérer l’audit');
        pollFailsRef.current += 1;
        if (pollFailsRef.current < 8) {
          timer = setTimeout(poll, 2500);
        }
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, auditId]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const softClose = () => {
    if (!busy) onClose?.();
  };

  const apply = async () => {
    if (!auditId) return;
    setBusy(true);
    setError('');
    try {
      const acceptItemIds = suggested.filter((i) => selected.has(i.id)).map((i) => i.id);
      const rejectItemIds = suggested.filter((i) => !selected.has(i.id)).map((i) => i.id);
      const result = await projectService.applyProjectAudit(projectId, auditId, {
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

  const rejectAllAndClose = async () => {
    if (!auditId) {
      onClose?.();
      return;
    }
    setBusy(true);
    try {
      await projectService.dismissProjectAudit(projectId, auditId);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Fermeture impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-audit-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-prune-900/50"
        aria-label="Fermer"
        onClick={softClose}
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-topaz-600">
              {assistantPhrases.scan || 'Fabulous'}
            </p>
            <h2 id="project-audit-title" className="text-lg font-bold text-prune-900 mt-0.5">
              Audit expert du projet
            </h2>
            {status === 'ready' && (
              <p className="text-sm text-prune-600 mt-1">
                Viabilité, rentabilité et propositions — validez ou rejetez.
              </p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="text-prune-500 hover:text-prune-800 text-sm font-medium"
            onClick={softClose}
            disabled={busy}
          >
            Plus tard
          </button>
        </div>

        {(status === 'pending' || status === 'processing' || !payload) && (
          <FabulousThinking
            message="Fabulous relit tout le projet et prépare son avis d’expert…"
            className="py-6"
          />
        )}

        {status === 'failed' && (
          <div className="space-y-4">
            <p className="text-sm text-prune-700 bg-prune-50 rounded-xl p-3">
              {payload?.audit?.errorMessage || 'Audit impossible pour le moment.'}
            </p>
            <button type="button" className="btn-secondary" onClick={softClose} disabled={busy}>
              Fermer
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-4">
            {payload?.audit?.overallVerdict && (
              <p className="text-sm font-medium text-prune-900 bg-topaz-50 border border-topaz-100 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                {payload.audit.overallVerdict}
              </p>
            )}
            {payload?.audit?.viabilitySummary && (
              <div className="rounded-xl bg-prune-50 p-3">
                <p className="text-xs font-semibold uppercase text-prune-500">Viabilité</p>
                <p className="text-sm text-prune-800 mt-1 leading-relaxed whitespace-pre-wrap">
                  {payload.audit.viabilitySummary}
                </p>
              </div>
            )}
            {payload?.audit?.profitabilitySummary && (
              <div className="rounded-xl bg-prune-50 p-3">
                <p className="text-xs font-semibold uppercase text-prune-500">Rentabilité</p>
                <p className="text-sm text-prune-800 mt-1 leading-relaxed whitespace-pre-wrap">
                  {payload.audit.profitabilitySummary}
                </p>
              </div>
            )}

            {suggested.length === 0 ? (
              <p className="text-sm text-prune-600">
                Aucune proposition nouvelle (ou déjà rejetées pour ce contexte projet).
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
                            {item.itemType === 'field' ? 'Cadrage' : 'Action'}
                            {item.actionKind ? ` · ${item.actionKind}` : ''}
                          </span>
                          {item.priority === 'high' && (
                            <span className="text-xs font-medium text-amber-700">prioritaire</span>
                          )}
                        </span>
                        <span className="block font-semibold text-prune-900 mt-0.5">
                          {item.title}
                        </span>
                        {item.currentValue && (
                          <span className="block text-xs text-prune-500 mt-1">
                            Actuel : {item.currentValue}
                          </span>
                        )}
                        {item.proposedValue && (
                          <span className="block text-sm text-prune-800 mt-0.5">
                            → {item.proposedValue}
                          </span>
                        )}
                        {(item.body || item.rationale) && (
                          <span className="block text-sm text-prune-600 mt-1 leading-relaxed">
                            {item.rationale || item.body}
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
              <button
                type="button"
                className="btn-secondary"
                onClick={suggested.length ? rejectAllAndClose : softClose}
                disabled={busy}
              >
                {suggested.length ? 'Tout rejeter' : 'Fermer'}
              </button>
              {suggested.length > 0 && (
                <button type="button" className="btn-primary" onClick={apply} disabled={busy}>
                  {busy ? 'Enregistrement…' : `Valider (${[...selected].length})`}
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

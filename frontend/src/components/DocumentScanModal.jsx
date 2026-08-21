import { useEffect, useMemo, useState } from 'react';
import { projectService } from '../services/projectService.js';

const TYPE_LABEL = {
  contact: 'Contact',
  date: 'Date',
  address: 'Adresse',
};

function formatConfidence(value) {
  if (value == null) return null;
  return `${Math.round(Number(value) * 100)} %`;
}

function formatDateLabel(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function itemSubtitle(item) {
  const p = item.payload || {};
  if (item.itemType === 'contact') {
    return [p.email, p.phone, p.organization].filter(Boolean).join(' · ') || p.snippet || '';
  }
  if (item.itemType === 'date') {
    return [formatDateLabel(p.startAt), p.kind].filter(Boolean).join(' · ');
  }
  if (item.itemType === 'address') {
    return [p.addressLine1, p.postalCode, p.city].filter(Boolean).join(', ');
  }
  return p.snippet || '';
}

/**
 * Modal de revue après scan IA d'un document.
 * Poll jusqu'à status ready|failed|dismissed, puis propose d'accepter / ignorer.
 */
export default function DocumentScanModal({
  projectId,
  scanId: initialScanId,
  documentId,
  onClose,
  onApplied,
}) {
  const [scanId, setScanId] = useState(initialScanId);
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const status = payload?.scan?.status;
  const suggested = useMemo(
    () => (payload?.items || []).filter((i) => i.status === 'suggested'),
    [payload]
  );

  useEffect(() => {
    setScanId(initialScanId);
  }, [initialScanId]);

  useEffect(() => {
    if (!projectId || !scanId) return undefined;
    let active = true;
    let timer;

    const poll = async () => {
      try {
        const data = await projectService.getDocumentScan(projectId, scanId);
        if (!active) return;
        setPayload(data);
        setError('');
        const st = data?.scan?.status;
        if (st === 'pending' || st === 'processing') {
          timer = setTimeout(poll, 1500);
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
        setError(err.message || 'Impossible de récupérer le scan');
        timer = setTimeout(poll, 2500);
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, scanId]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    if (!scanId) return;
    setBusy(true);
    setError('');
    try {
      const acceptItemIds = suggested.filter((i) => selected.has(i.id)).map((i) => i.id);
      const rejectItemIds = suggested.filter((i) => !selected.has(i.id)).map((i) => i.id);
      await projectService.applyDocumentScan(projectId, scanId, {
        acceptItemIds,
        rejectItemIds,
      });
      onApplied?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Application impossible');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (!scanId) {
      onClose?.();
      return;
    }
    setBusy(true);
    try {
      await projectService.dismissDocumentScan(projectId, scanId);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Fermeture impossible');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!documentId) return;
    setBusy(true);
    setError('');
    try {
      const { scan } = await projectService.retryDocumentScan(projectId, documentId);
      setScanId(scan.id);
      setPayload(null);
      setSelected(new Set());
    } catch (err) {
      setError(err.message || 'Relance impossible');
    } finally {
      setBusy(false);
    }
  };

  const title =
    payload?.document?.title || payload?.document?.fileName || 'Analyse du document';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-scan-title"
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
              Scan IA
            </p>
            <h2 id="doc-scan-title" className="text-lg font-bold text-prune-900 mt-0.5">
              {title}
            </h2>
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
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-topaz-400 border-t-transparent animate-spin" />
            <p className="text-prune-800 font-medium">Analyse du document…</p>
            <p className="text-sm text-prune-500 mt-1">
              Recherche de contacts, dates et adresses
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-4">
            <p className="text-sm text-prune-700 bg-prune-50 rounded-xl p-3">
              {payload?.scan?.errorMessage || 'Le scan a échoué.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={dismiss} disabled={busy}>
                Fermer
              </button>
              {documentId && (
                <button type="button" className="btn-primary" onClick={retry} disabled={busy}>
                  Relancer
                </button>
              )}
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-4">
            {suggested.length === 0 ? (
              <p className="text-sm text-prune-600 py-4">
                Aucune suggestion à ajouter (contacts, dates ou adresses).
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
                            {TYPE_LABEL[item.itemType] || item.itemType}
                          </span>
                          {item.matchedEntityId && (
                            <span className="text-xs text-topaz-700 font-medium">
                              déjà connu
                            </span>
                          )}
                          {formatConfidence(item.confidence) && (
                            <span className="text-xs text-prune-400">
                              {formatConfidence(item.confidence)}
                            </span>
                          )}
                        </span>
                        <span className="block font-semibold text-prune-900 mt-0.5">
                          {item.label}
                        </span>
                        {itemSubtitle(item) && (
                          <span className="block text-sm text-prune-600 mt-0.5">
                            {itemSubtitle(item)}
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
                Tout ignorer
              </button>
              {suggested.length > 0 && (
                <button type="button" className="btn-primary" onClick={apply} disabled={busy}>
                  {busy
                    ? 'Enregistrement…'
                    : `Ajouter (${[...selected].length})`}
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

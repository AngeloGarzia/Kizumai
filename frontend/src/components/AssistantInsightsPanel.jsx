import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService.js';
import { assistantPhrases } from '../constants/assistant.js';

const KIND_LABEL = {
  deadline: 'Échéance',
  missing_document: 'Document',
  stagnation: 'Activité',
  reflection: 'Réflexion',
  action: 'Action',
  reorientation: 'Réorientation',
  scan_pending: 'Scan',
};

/**
 * Bandeau + liste des insights assistant Fabulous (fond de tâche).
 */
export default function AssistantInsightsPanel({
  projectId,
  onOpenReorientation,
}) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!projectId) return;
    try {
      const data = await projectService.listAssistantInsights(projectId);
      setInsights(data?.insights || []);
      setOpenCount(data?.openCount ?? 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Impossible de charger les alertes Fabulous');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [projectId]);

  if (!projectId || (openCount === 0 && insights.length === 0)) {
    return null;
  }

  const act = async (insight, status) => {
    setBusyId(insight.id);
    try {
      await projectService.updateAssistantInsight(projectId, insight.id, status);
      await load();
    } catch (err) {
      setError(err.message || 'Mise à jour impossible');
    } finally {
      setBusyId(null);
    }
  };

  const openInsight = async (insight) => {
    const url = insight.payload?.url || '/';
    const reviewId = insight.payload?.reviewId;

    if (insight.kind === 'reorientation' || reviewId) {
      onOpenReorientation?.(reviewId || null);
      await act(insight, 'read');
      return;
    }

    await act(insight, 'read');
    if (url.startsWith('/')) navigate(url);
  };

  return (
    <section className="rounded-2xl border border-topaz-200 bg-topaz-50/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-topaz-700">
            {assistantPhrases.scan || 'Fabulous'}
          </p>
          <h2 className="text-base font-bold text-prune-900 mt-0.5">
            {openCount > 0
              ? `${openCount} point${openCount > 1 ? 's' : ''} d’attention`
              : 'Assistant projet'}
          </h2>
          <p className="text-sm text-prune-600 mt-1">
            Analyse en fond de tâche : échéances, documents, réflexions.
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-topaz-700 hover:underline shrink-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Réduire' : 'Voir'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {expanded && (
        <ul className="mt-4 space-y-2">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="rounded-xl bg-white border border-prune-100 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-prune-500">
                  {KIND_LABEL[insight.kind] || insight.kind}
                </span>
                {insight.priority === 'high' && (
                  <span className="text-xs font-medium text-amber-700">prioritaire</span>
                )}
                {insight.status === 'open' && (
                  <span className="text-xs text-topaz-700">nouveau</span>
                )}
              </div>
              <p className="font-semibold text-prune-900 mt-1">{insight.title}</p>
              {insight.body && (
                <p className="text-sm text-prune-600 mt-1 leading-relaxed whitespace-pre-wrap">
                  {insight.body}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="text-xs font-semibold text-topaz-700 hover:underline"
                  disabled={busyId === insight.id}
                  onClick={() => openInsight(insight)}
                >
                  Ouvrir
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-prune-500 hover:underline"
                  disabled={busyId === insight.id}
                  onClick={() => act(insight, 'dismissed')}
                >
                  Ignorer
                </button>
              </div>
            </li>
          ))}
          {insights.length === 0 && (
            <li className="text-sm text-prune-500 py-2">Aucune alerte ouverte.</li>
          )}
        </ul>
      )}
    </section>
  );
}

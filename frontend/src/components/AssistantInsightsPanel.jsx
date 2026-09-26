import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Lance un checkup à l’ouverture du projet pour ne pas attendre le cron.
 */
export default function AssistantInsightsPanel({
  projectId,
  onOpenReorientation,
}) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [lastRun, setLastRun] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const checkupOnceRef = useRef(null);

  const load = useCallback(async () => {
    if (!projectId) return null;
    try {
      const data = await projectService.listAssistantInsights(projectId);
      setInsights(data?.insights || []);
      setOpenCount(data?.openCount ?? 0);
      setLastRun(data?.lastRun || null);
      setError('');
      return data;
    } catch (err) {
      setError(err.message || 'Impossible de charger les alertes Fabulous');
      return null;
    }
  }, [projectId]);

  const startCheckup = useCallback(async () => {
    if (!projectId) return;
    setAnalyzing(true);
    setError('');
    try {
      await projectService.requestAssistantCheckup(projectId);
    } catch (err) {
      setError(err.message || 'Impossible de lancer l’analyse');
      setAnalyzing(false);
      return;
    }

    const started = Date.now();
    const poll = async () => {
      const data = await load();
      const status = data?.lastRun?.status;
      const done = status === 'ready' || status === 'failed';
      const timedOut = Date.now() - started > 90_000;
      if (done || timedOut) {
        setAnalyzing(false);
        if (status === 'failed') {
          setError(
            data?.lastRun?.errorMessage ||
              'Analyse Fabulous en échec (vérifiez migrations / prompt / IA).'
          );
        }
        return;
      }
      setTimeout(poll, 2500);
    };
    setTimeout(poll, 1500);
  }, [projectId, load]);

  useEffect(() => {
    if (!projectId) return undefined;
    checkupOnceRef.current = null;
    let active = true;

    (async () => {
      const data = await load();
      if (!active) return;
      const status = data?.lastRun?.status;
      const fresh =
        data?.lastRun?.finishedAt &&
        Date.now() - new Date(data.lastRun.finishedAt).getTime() < 30 * 60 * 1000;
      const needsCheckup =
        !data?.lastRun ||
        status === 'failed' ||
        ((data?.openCount || 0) === 0 && !fresh && status !== 'processing' && status !== 'pending');

      if (needsCheckup && checkupOnceRef.current !== projectId) {
        checkupOnceRef.current = projectId;
        await startCheckup();
      } else if (status === 'processing' || status === 'pending') {
        setAnalyzing(true);
        checkupOnceRef.current = projectId;
        const started = Date.now();
        const poll = async () => {
          if (!active) return;
          const next = await load();
          const st = next?.lastRun?.status;
          if (st === 'ready' || st === 'failed' || Date.now() - started > 90_000) {
            setAnalyzing(false);
            return;
          }
          setTimeout(poll, 2500);
        };
        setTimeout(poll, 1500);
      }
    })();

    const timer = setInterval(() => {
      if (!analyzing) load();
    }, 60_000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [projectId, load, startCheckup, analyzing]);

  if (!projectId) return null;

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
            {analyzing
              ? 'Fabulous analyse votre projet…'
              : openCount > 0
                ? `${openCount} point${openCount > 1 ? 's' : ''} d’attention`
                : 'Assistant projet'}
          </h2>
          <p className="text-sm text-prune-600 mt-1">
            {analyzing
              ? 'Échéances, documents et suggestions en cours de préparation.'
              : openCount > 0
                ? 'Analyse en fond de tâche : échéances, documents, réflexions.'
                : 'Aucune alerte pour le moment — vous pouvez relancer une analyse.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            className="text-sm font-semibold text-topaz-700 hover:underline disabled:opacity-50"
            disabled={analyzing}
            onClick={() => startCheckup()}
          >
            {analyzing ? 'Analyse…' : 'Analyser'}
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-prune-500 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Réduire' : 'Voir'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {expanded && (
        <ul className="mt-4 space-y-2">
          {analyzing && insights.length === 0 && (
            <li className="text-sm text-prune-600 py-2">Patientez quelques secondes…</li>
          )}
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
          {!analyzing && insights.length === 0 && !error && (
            <li className="text-sm text-prune-500 py-2">
              Aucune proposition pour l’instant. Ajoutez un document, une échéance, ou cliquez
              sur Analyser.
            </li>
          )}
        </ul>
      )}

      {lastRun?.status === 'failed' && !error && (
        <p className="text-xs text-prune-500 mt-2">
          Dernière analyse en échec — vérifiez que les migrations 061–063 sont appliquées.
        </p>
      )}
    </section>
  );
}

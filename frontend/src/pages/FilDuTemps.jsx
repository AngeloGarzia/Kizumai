import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { projectService } from '../services/projectService.js';

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'document', label: 'Docs' },
  { id: 'stage', label: 'Parcours' },
  { id: 'ai', label: 'IA' },
  { id: 'contact', label: 'Contacts' },
  { id: 'planner', label: 'Agenda' },
  { id: 'learning', label: 'Compétences' },
  { id: 'project', label: 'Projet' },
];

const CATEGORY_STYLE = {
  document: { dot: 'bg-topaz-500', badge: 'bg-topaz-100 text-topaz-800' },
  stage: { dot: 'bg-wasabi-500', badge: 'bg-wasabi-100 text-wasabi-800' },
  ai: { dot: 'bg-prune-500', badge: 'bg-prune-100 text-prune-800' },
  contact: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-900' },
  planner: { dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-900' },
  learning: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-900' },
  project: { dot: 'bg-prune-400', badge: 'bg-prune-50 text-prune-700' },
  company: { dot: 'bg-stone-500', badge: 'bg-stone-100 text-stone-800' },
};

function formatDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(iso) {
  if (!iso) return 'unknown';
  return new Date(iso).toISOString().slice(0, 10);
}

/** Regroupe les événements adjacents qui portent le même titre. */
function groupAdjacentByTitle(events) {
  const stacks = [];
  for (const ev of events) {
    const titleKey = String(ev.title || '').trim().toLowerCase();
    const last = stacks[stacks.length - 1];
    if (last && last.titleKey === titleKey && titleKey) {
      last.events.push(ev);
    } else {
      stacks.push({
        id: `stack-${ev.id}`,
        titleKey,
        title: ev.title || 'Sans titre',
        category: ev.category,
        events: [ev],
      });
    }
  }
  return stacks;
}

function IconChevron({ className = 'w-4 h-4', open = false }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function EventActions({ event, projectId }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {event.meta?.documentId && (
        <a
          href={projectService.documentDownloadUrl(projectId, event.meta.documentId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-topaz-50 px-2.5 py-1 text-xs font-semibold text-topaz-700 hover:bg-topaz-100"
        >
          <IconDoc className="w-3.5 h-3.5" />
          Ouvrir
        </a>
      )}
      {event.href && (
        <Link
          to={event.href}
          className="inline-flex items-center rounded-full bg-prune-50 px-2.5 py-1 text-xs font-semibold text-prune-700 hover:bg-prune-100"
        >
          Voir
        </Link>
      )}
    </div>
  );
}

function TimelineStack({ stack, projectId, open, onToggle }) {
  const style = CATEGORY_STYLE[stack.category] || CATEGORY_STYLE.project;
  const count = stack.events.length;
  const first = stack.events[0];
  const last = stack.events[count - 1];
  const timeLabel =
    count > 1 && first.at !== last.at
      ? `${formatTime(first.at)} – ${formatTime(last.at)}`
      : formatTime(first.at);

  return (
    <li className="relative">
      <span
        className={`absolute -left-6 top-3 h-3 w-3 rounded-full ring-4 ring-white ${style.dot}`}
        aria-hidden
      />
      <article className="rounded-2xl border border-prune-100/90 bg-white/95 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="w-full text-left p-3.5 flex items-start gap-3 hover:bg-prune-50/50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
              >
                {stack.category}
              </span>
              <time className="text-[11px] text-prune-400 tabular-nums">{timeLabel}</time>
              {count > 1 && (
                <span className="rounded-full bg-prune-800 text-white px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  ×{count}
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-prune-900">{stack.title}</h4>
            {!open && (
              <p className="mt-1 text-sm text-prune-500 leading-snug line-clamp-1">
                {count > 1
                  ? `${count} entrées regroupées`
                  : first.summary || 'Appuyer pour déplier'}
              </p>
            )}
          </div>
          <IconChevron open={open} className="w-4 h-4 text-prune-400 shrink-0 mt-1" />
        </button>

        {open && (
          <div className="border-t border-prune-100 px-3.5 pb-3.5 pt-2 space-y-3">
            {stack.events.map((ev) => (
              <div
                key={ev.id}
                className={
                  count > 1
                    ? 'rounded-xl bg-prune-50/60 border border-prune-100/80 p-3'
                    : 'pt-1'
                }
              >
                {count > 1 && (
                  <time className="text-[11px] text-prune-400 tabular-nums">
                    {formatTime(ev.at)}
                  </time>
                )}
                {ev.summary && (
                  <p className="mt-0.5 text-sm text-prune-600 leading-snug">
                    {ev.summary}
                  </p>
                )}
                <EventActions event={ev} projectId={projectId} />
              </div>
            ))}
          </div>
        )}
      </article>
    </li>
  );
}

function IconBrain({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 4.5a3 3 0 00-3 3v.3A3.5 3.5 0 004 11.2V13a3 3 0 002.2 2.9M14.5 4.5a3 3 0 013 3v.3A3.5 3.5 0 0120 11.2V13a3 3 0 01-2.2 2.9M8 16.5c.8 1.7 2.2 3 4 3s3.2-1.3 4-3M9 9.5h.01M15 9.5h.01M9.5 12.5c.8.8 1.9 1.2 2.5 1.2s1.7-.4 2.5-1.2"
      />
    </svg>
  );
}

function IconSync({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 9A8 8 0 006.3 5.3L4 8M3.5 15a8 8 0 0014.2 3.7L20 16" />
    </svg>
  );
}

function IconDoc({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export default function FilDuTemps() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid } = useAuth();
  const { currentProjectId } = useProject();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [situationBusy, setSituationBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [situation, setSituation] = useState(null);
  const [scanMessage, setScanMessage] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [expandedDays, setExpandedDays] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!currentProjectId) {
      setTimeline(null);
      setLoading(false);
      setError('Aucun projet pour l’instant. Crée ton avenir pour voir le fil du temps.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await projectService.getTimelineForProject(currentProjectId);
      setTimeline(data);
    } catch (err) {
      setError(err.message || 'Impossible de charger le fil du temps');
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (!isAuthenticated || !isPaid) {
      navigate('/login', { state: { from: '/fil-du-temps' } });
      return;
    }
    load();
  }, [isAuthenticated, isPaid, navigate, load]);

  useEffect(() => {
    setExpandedIds(new Set());
    setExpandedDays(new Set());
  }, [filter, timeline?.projectId]);

  const filteredEvents = useMemo(() => {
    const events = timeline?.events || [];
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== 'all' && e.category !== filter) return false;
      if (!q) return true;
      const haystack = [
        e.title,
        e.summary,
        e.category,
        e.type,
        e.meta?.fileName,
        e.meta?.categoryTitle,
        e.meta?.organization,
        e.meta?.stage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [timeline, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of filteredEvents) {
      const key = dayKey(ev.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()].map(([key, events]) => [
      key,
      groupAdjacentByTitle(events),
    ]);
  }, [filteredEvents]);

  // En recherche : ouvrir les jours pour voir les résultats ; sinon tout refermer
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setExpandedDays(new Set());
      setExpandedIds(new Set());
      return;
    }
    setExpandedDays(new Set(grouped.map(([key]) => key)));
  }, [search, grouped]);

  const toggleStack = (stackId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stackId)) next.delete(stackId);
      else next.add(stackId);
      return next;
    });
  };

  const toggleDay = (dayId) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  };
  const runSituation = async () => {
    if (!timeline?.projectId || situationBusy) return;
    setSituationBusy(true);
    setAiError('');
    try {
      const result = await projectService.getSituationSummaryForProject(timeline.projectId);
      setSituation(result);
    } catch (err) {
      setAiError(err.message || 'Échec du résumé IA');
    } finally {
      setSituationBusy(false);
    }
  };

  const runScan = async () => {
    if (!timeline?.projectId || scanBusy) return;
    setScanBusy(true);
    setAiError('');
    setScanMessage('');
    try {
      const result = await projectService.scanProjectMemoryForProject(timeline.projectId);
      const c = result.counts || {};
      setScanMessage(
        `Mémoire synchronisée : ${c.nodes || 0} souvenir(s), ${c.edges || 0} lien(s)`
      );
      await load();
    } catch (err) {
      setAiError(err.message || 'Échec du scan mémoire');
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-prune-50 via-white to-wasabi-50/40 pb-28">
      <header className="sticky top-0 z-20 border-b border-prune-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <BrandLogo size="sm" />
          <h1 className="text-sm font-bold tracking-wide text-prune-800 uppercase">
            Fil du temps
          </h1>
          <Link
            to="/ressources"
            className="text-xs font-semibold text-topaz-600 hover:text-topaz-500"
          >
            Docs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5 space-y-5">
        {loading && (
          <p className="text-sm text-prune-500 animate-pulse">Chargement du fil…</p>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            {!error.includes('Aucun projet') ? null : (
              <div className="mt-3">
                <Button onClick={() => navigate('/creer-son-avenir')}>Créer mon avenir</Button>
              </div>
            )}
          </div>
        )}

        {timeline && (
          <>
            <section className="rounded-3xl bg-white/90 border border-prune-100 shadow-sm p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-prune-500 mb-1">
                Projet
              </p>
              <h2 className="text-xl font-bold text-prune-900 leading-snug">
                {timeline.projectTitle || `Projet #${timeline.projectId}`}
              </h2>
              <p className="text-sm text-prune-600 mt-1">
                {timeline.total} événement(s)
                {timeline.documents?.length
                  ? ` · ${timeline.documents.length} document(s)`
                  : ''}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={situationBusy}
                  onClick={runSituation}
                  className="inline-flex items-center gap-2"
                >
                  <IconBrain className="w-4 h-4" />
                  {situationBusy ? 'Résumé…' : 'Où j’en suis'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={scanBusy}
                  onClick={runScan}
                  className="inline-flex items-center gap-2"
                >
                  <IconSync className="w-4 h-4" />
                  {scanBusy ? 'Scan…' : 'Scanner → mémoire'}
                </Button>
              </div>

              {aiError && (
                <p className="mt-3 text-sm text-red-700">{aiError}</p>
              )}
              {scanMessage && (
                <p className="mt-3 text-sm text-wasabi-800 whitespace-pre-line">{scanMessage}</p>
              )}
              {situation?.summary && (
                <div className="mt-4 rounded-2xl bg-prune-50 border border-prune-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-prune-500 mb-2">
                    Résumé IA
                  </p>
                  <p className="text-sm text-prune-800 whitespace-pre-wrap leading-relaxed">
                    {situation.summary}
                  </p>
                  {Array.isArray(situation.nextActions) && situation.nextActions.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {situation.nextActions.slice(0, 5).map((a, i) => (
                        <li key={i} className="text-sm text-prune-700 flex gap-2">
                          <span className="text-wasabi-600">→</span>
                          <span>{typeof a === 'string' ? a : a?.title || a?.label || JSON.stringify(a)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {!situation?.summary && timeline.snapshot?.summary && (
                <div className="mt-4 rounded-2xl bg-wasabi-50/80 border border-wasabi-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-wasabi-700 mb-2">
                    Dernier snapshot mémoire
                  </p>
                  <p className="text-sm text-prune-800 leading-relaxed">
                    {timeline.snapshot.summary}
                  </p>
                </div>
              )}
            </section>

            {timeline.documents?.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-widest text-prune-600 uppercase">
                    Accès rapide documents
                  </h3>
                  <Link
                    to="/ressources"
                    className="text-xs font-semibold text-topaz-600 hover:text-topaz-500"
                  >
                    Tous
                  </Link>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                  {timeline.documents.slice(0, 12).map((doc) => (
                    <a
                      key={doc.id}
                      href={projectService.documentDownloadUrl(timeline.projectId, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 max-w-[11rem] rounded-2xl border border-prune-100 bg-white px-3 py-2.5 shadow-sm hover:border-topaz-300 hover:shadow transition-shadow"
                    >
                      <span className="flex items-center gap-2 text-topaz-600 mb-1">
                        <IconDoc />
                        <span className="text-[10px] font-bold uppercase tracking-wide truncate">
                          {doc.type || 'doc'}
                        </span>
                      </span>
                      <span className="block text-xs font-semibold text-prune-900 line-clamp-2">
                        {doc.title || doc.fileName}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-3">
                <Input
                  id="timeline-search"
                  type="search"
                  label="Rechercher"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Événement, document, contact…"
                  autoComplete="off"
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {search.trim() ? (
                    <p className="text-xs text-prune-500">
                      {filteredEvents.length} résultat{filteredEvents.length !== 1 ? 's' : ''}
                    </p>
                  ) : (
                    <span />
                  )}
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-xs font-semibold text-prune-500 hover:text-prune-800"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={[
                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                        active
                          ? 'bg-prune-800 text-white'
                          : 'bg-white text-prune-700 border border-prune-100 hover:border-prune-300',
                      ].join(' ')}
                    >
                      {f.label}
                      {f.id !== 'all' && timeline.byCategory?.[f.id]
                        ? ` ${timeline.byCategory[f.id]}`
                        : ''}
                    </button>
                  );
                })}
              </div>

              {grouped.length === 0 ? (
                <p className="text-sm text-prune-500 py-8 text-center">
                  {search.trim()
                    ? 'Aucun événement ne correspond à ta recherche.'
                    : 'Aucun événement pour ce filtre.'}
                </p>
              ) : (
                <ol className="relative mt-2 space-y-3">
                  {grouped.map(([key, stacks]) => {
                    const dayOpen = expandedDays.has(key);
                    const eventCount = stacks.reduce((n, s) => n + s.events.length, 0);
                    const stackCount = stacks.length;
                    return (
                      <li
                        key={key}
                        className="rounded-2xl border border-prune-100/90 bg-white/90 shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleDay(key)}
                          aria-expanded={dayOpen}
                          className="sticky top-[3.25rem] z-10 w-full flex items-center gap-3 px-3.5 py-3 text-left bg-prune-50/95 backdrop-blur-sm hover:bg-prune-100/80 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold capitalize text-prune-900">
                              {formatDay(stacks[0]?.events[0]?.at)}
                            </p>
                            <p className="text-xs text-prune-500 mt-0.5">
                              {stackCount} tuile{stackCount > 1 ? 's' : ''}
                              {' · '}
                              {eventCount} événement{eventCount > 1 ? 's' : ''}
                            </p>
                          </div>
                          <IconChevron
                            open={dayOpen}
                            className="w-4 h-4 text-prune-400 shrink-0"
                          />
                        </button>

                        {dayOpen && (
                          <div className="relative pl-6 pr-3 pb-3 pt-3 before:absolute before:left-[1.2rem] before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-prune-200 before:via-wasabi-200 before:to-transparent">
                            <ul className="space-y-3">
                              {stacks.map((stack) => (
                                <TimelineStack
                                  key={stack.id}
                                  stack={stack}
                                  projectId={timeline.projectId}
                                  open={expandedIds.has(stack.id)}
                                  onToggle={() => toggleStack(stack.id)}
                                />
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

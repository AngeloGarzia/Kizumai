/**
 * Workspace d'étape de parcours (workflows, jalons, docs, contacts).
 * Réutilisé pour étude de marché, BP, financement, immat, lancement.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import BrandLogo from './BrandLogo.jsx';
import DocumentScanModal from './DocumentScanModal.jsx';
import { IconChevronRight } from './icons.jsx';
import { projectService } from '../services/projectService.js';
import { PROJECT_STAGE_LABELS, nextStageId, stageHref } from '../constants/projectStages.js';
import { useProject } from '../context/ProjectContext.jsx';
import { DOCUMENT_ACCEPT } from '../utils/safeDisplay.js';

const STATUS_LABELS = {
  not_started: 'Non démarrée',
  in_progress: 'En cours',
  completed: 'Terminée',
  blocked: 'Bloquée',
};

const DEFAULT_CONTACT_ROLE = {
  etude_marche: 'interviewé',
  business_plan: 'conseiller',
  financement: 'banquier',
  immatriculation: 'expert_comptable',
  lancement: 'partenaire',
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function TaskRow({ task, busy, onToggle }) {
  const done = task.status === 'done';
  return (
    <li className="flex items-start gap-3 py-3 border-b border-prune-50 last:border-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(task)}
        className={[
          'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
          done
            ? 'bg-wasabi-500 border-wasabi-500 text-white'
            : 'border-prune-300 bg-white hover:border-topaz-400',
        ].join(' ')}
        aria-label={done ? 'Marquer à faire' : 'Marquer terminé'}
      >
        {done ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? 'text-prune-500 line-through' : 'text-prune-900'}`}>
          {task.action?.title || 'Action'}
        </p>
        {task.action?.description && (
          <p className="text-sm text-prune-500 mt-0.5">{task.action.description}</p>
        )}
        {task.action?.isRequired && (
          <span className="inline-block mt-1 text-xs font-semibold text-topaz-600">Obligatoire</span>
        )}
      </div>
    </li>
  );
}

export default function StageWorkspace({ projectId, stage }) {
  const id = projectId;
  const navigate = useNavigate();
  const { setCurrentProjectId } = useProject();
  const fileRef = useRef(null);
  const stageLabel = PROJECT_STAGE_LABELS[stage] || stage;
  const defaultRole = DEFAULT_CONTACT_ROLE[stage] || 'contact';

  const [data, setData] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [contactForm, setContactForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: defaultRole,
  });
  const [projectDocs, setProjectDocs] = useState([]);
  const [scanModal, setScanModal] = useState(null);

  const applyPayload = (payload) => {
    setData(payload);
    if (payload?.milestones?.length) {
      setSelectedMilestone((prev) => {
        if (prev && payload.milestones.some((m) => m.id === prev.id)) {
          return payload.milestones.find((m) => m.id === prev.id) || payload.milestones[0];
        }
        return payload.milestones[0];
      });
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [stageData, proj, docs] = await Promise.all([
        projectService.getStage(id, stage),
        projectService.getProject(id),
        projectService.listDocuments(id),
      ]);
      applyPayload(stageData);
      setProject(proj);
      setProjectDocs(Array.isArray(docs) ? docs : []);
    } catch (err) {
      setError(err.message || `Impossible de charger « ${stageLabel} »`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) setCurrentProjectId(id);
  }, [id, setCurrentProjectId]);

  useEffect(() => {
    setContactForm((f) => ({ ...f, role: defaultRole }));
    setSelectedMilestone(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stage]);

  const toggleTask = async (task) => {
    setBusy(true);
    setError('');
    try {
      const next = task.status === 'done' ? 'todo' : 'done';
      const payload = await projectService.updateStageTask(id, stage, task.id, { status: next });
      applyPayload(payload);
    } catch (err) {
      setError(err.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

  const toggleMilestone = async (milestone) => {
    setSelectedMilestone(milestone);
    setBusy(true);
    try {
      const next = milestone.status === 'done' ? 'planned' : 'done';
      const payload = await projectService.updateStageMilestone(id, stage, milestone.id, {
        status: next,
      });
      applyPayload(payload);
      const updated = payload.milestones?.find((m) => m.id === milestone.id);
      if (updated) setSelectedMilestone(updated);
    } catch (err) {
      setError(err.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const doc = await projectService.uploadDocument(id, file);
      const payload = await projectService.addStageLink(id, stage, {
        entityType: 'document',
        entityId: doc.id,
        role: 'preuve',
      });
      applyPayload(payload);
      const docs = await projectService.listDocuments(id);
      setProjectDocs(Array.isArray(docs) ? docs : []);
      if (doc.scanId) {
        setScanModal({ scanId: doc.scanId, documentId: doc.id });
      }
    } catch (err) {
      setError(err.message || 'Téléversement impossible');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const linkExistingDoc = async (docId) => {
    setBusy(true);
    try {
      const payload = await projectService.addStageLink(id, stage, {
        entityType: 'document',
        entityId: docId,
        role: 'preuve',
      });
      applyPayload(payload);
    } catch (err) {
      setError(err.message || 'Liaison impossible');
    } finally {
      setBusy(false);
    }
  };

  const createContact = async (e) => {
    e.preventDefault();
    if (!contactForm.displayName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = await projectService.createStageContact(id, stage, contactForm);
      applyPayload(payload);
      setContactForm({ displayName: '', email: '', phone: '', role: defaultRole });
    } catch (err) {
      setError(err.message || 'Création du contact impossible');
    } finally {
      setBusy(false);
    }
  };

  const linkedDocIds = new Set((data?.documents || []).map((d) => d.entityId));

  if (loading) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-prune-500">Chargement de {stageLabel}…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        <header className="sticky top-0 z-10 header-glass">
          <div className="page-container py-4 sm:py-5 flex items-center justify-between gap-3">
            <BrandLogo size="sm" />
            <Link to="/parcours" className="btn-secondary text-sm">
              Retour
            </Link>
          </div>
        </header>

        <main className="page-container flex-1 space-y-6 sm:space-y-8 max-w-[50.4rem] lg:max-w-[67.2rem]">
          <section className="pt-2">
            <p className="text-xs font-semibold tracking-widest text-prune-600 uppercase">
              {stageLabel}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-prune-900">
              {project?.title || project?.quoi || 'Projet'}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-prune-600">
                {STATUS_LABELS[data?.run?.status] || data?.run?.status}
              </span>
              <div className="flex-1 min-w-[8rem] h-2 rounded-full bg-prune-100 overflow-hidden">
                <div
                  className="h-full bg-topaz-500 transition-all"
                  style={{ width: `${data?.progressPercent || 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-topaz-600">
                {data?.progressPercent || 0}%
              </span>
            </div>
          </section>

          {error && <p className="alert-error">{error}</p>}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-prune-900 mb-4">Dates clés</h2>
            {(data?.milestones || []).length === 0 ? (
              <p className="text-sm text-prune-500">Aucun jalon pour cette étape.</p>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute left-0 right-0 top-4 h-0.5 bg-prune-100" aria-hidden="true" />
                  <ul className="relative flex gap-2 overflow-x-auto pb-2">
                    {(data?.milestones || []).map((m) => {
                      const active = selectedMilestone?.id === m.id;
                      const done = m.status === 'done';
                      return (
                        <li key={m.id} className="shrink-0 w-36">
                          <button
                            type="button"
                            onClick={() => setSelectedMilestone(m)}
                            className={[
                              'w-full text-left rounded-xl border p-3 transition-colors',
                              active
                                ? 'border-topaz-400 bg-topaz-50'
                                : 'border-prune-100 bg-white hover:border-prune-300',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'block w-3 h-3 rounded-full mb-2',
                                done ? 'bg-wasabi-500' : 'bg-topaz-400',
                              ].join(' ')}
                            />
                            <span className="block text-xs text-prune-500">
                              {formatDate(m.milestoneAt)}
                            </span>
                            <span className="block text-sm font-semibold text-prune-900 mt-0.5 leading-snug">
                              {m.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {selectedMilestone && (
                  <div className="mt-4 rounded-xl bg-prune-50 border border-prune-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-prune-900">{selectedMilestone.title}</p>
                        <p className="text-sm text-prune-500 mt-1">
                          {formatDate(selectedMilestone.milestoneAt)}
                          {selectedMilestone.description
                            ? ` · ${selectedMilestone.description}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleMilestone(selectedMilestone)}
                        className="text-sm font-semibold text-topaz-600 hover:text-topaz-500 shrink-0"
                      >
                        {selectedMilestone.status === 'done' ? 'Rouvrir' : 'Valider'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-prune-900">Workflows</h2>
            {(data?.workflows || []).length === 0 ? (
              <p className="text-sm text-prune-500 card p-5">
                Aucun workflow pour cette étape pour le moment.
              </p>
            ) : (
              (data?.workflows || []).map((wf) => {
                const doneCount = wf.tasks.filter((t) => t.status === 'done').length;
                return (
                  <details
                    key={wf.slug}
                    className="card group"
                    open={doneCount < wf.tasks.length}
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3">
                      <span className="font-semibold text-prune-900">{wf.title}</span>
                      <span className="text-sm text-prune-500">
                        {doneCount}/{wf.tasks.length}
                        <IconChevronRight className="inline w-4 h-4 ml-1 group-open:rotate-90 transition-transform" />
                      </span>
                    </summary>
                    <ul className="px-5 pb-2">
                      {wf.tasks.map((task) => (
                        <TaskRow key={task.id} task={task} busy={busy} onToggle={toggleTask} />
                      ))}
                    </ul>
                  </details>
                );
              })
            )}
          </section>

          <section className="card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-prune-900">Documents liés</h2>
              <label className="btn-secondary text-sm cursor-pointer">
                Ajouter
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  accept={DOCUMENT_ACCEPT}
                />
              </label>
            </div>
            {(data?.documents || []).length === 0 ? (
              <p className="text-sm text-prune-500">
                Aucun document lié à cette étape pour le moment.
              </p>
            ) : (
              <ul className="divide-y divide-prune-100">
                {data.documents.map((link) => (
                  <li key={link.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-prune-900 truncate">
                        {link.entity?.title ||
                          link.entity?.fileName ||
                          `Document #${link.entityId}`}
                      </p>
                      <p className="text-xs text-prune-500">{link.role || 'lié'}</p>
                    </div>
                    {link.entity && (
                      <a
                        href={projectService.documentDownloadUrl(id, link.entityId)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-topaz-600 hover:underline shrink-0"
                      >
                        Ouvrir
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {projectDocs.some((d) => !linkedDocIds.has(d.id)) && (
              <div className="pt-2 border-t border-prune-100">
                <p className="text-xs font-semibold text-prune-500 uppercase mb-2">
                  Documents du projet à lier
                </p>
                <ul className="space-y-2">
                  {projectDocs
                    .filter((d) => !linkedDocIds.has(d.id))
                    .map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-prune-800">{d.title || d.fileName}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => linkExistingDoc(d.id)}
                          className="font-semibold text-topaz-600 shrink-0"
                        >
                          Lier
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-prune-900">Contacts de l&apos;étape</h2>
            {(data?.contacts || []).length === 0 ? (
              <p className="text-sm text-prune-500">Aucun contact lié pour le moment.</p>
            ) : (
              <ul className="divide-y divide-prune-100">
                {data.contacts.map((link) => (
                  <li key={link.id} className="py-3">
                    <p className="font-medium text-prune-900">
                      {link.entity?.displayName ||
                        [link.entity?.firstName, link.entity?.lastName]
                          .filter(Boolean)
                          .join(' ') ||
                        `Contact #${link.entityId}`}
                    </p>
                    <p className="text-sm text-prune-500">
                      {[link.role, link.entity?.email, link.entity?.phone]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={createContact}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-prune-100"
            >
              <input
                className="input-field sm:col-span-2"
                placeholder="Nom du contact *"
                value={contactForm.displayName}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, displayName: e.target.value }))
                }
                required
              />
              <input
                className="input-field"
                placeholder="Email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Téléphone"
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <input
                className="input-field sm:col-span-2"
                placeholder="Rôle"
                value={contactForm.role}
                onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
              />
              <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
                Ajouter le contact
              </button>
            </form>
          </section>

          <button
            type="button"
            onClick={() => navigate('/parcours')}
            className="btn-secondary w-full"
          >
            Retour au parcours
          </button>

          {(() => {
            const nextId = nextStageId(stage);
            if (!nextId || (data?.progressPercent || 0) < 100) return null;
            return (
              <button
                type="button"
                onClick={() => navigate(stageHref(nextId, id))}
                className="btn-cta w-full"
              >
                Passer à {PROJECT_STAGE_LABELS[nextId] || nextId}
              </button>
            );
          })()}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {scanModal && (
        <DocumentScanModal
          projectId={Number(id)}
          scanId={scanModal.scanId}
          documentId={scanModal.documentId}
          onClose={() => setScanModal(null)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import Button from '../components/Button.jsx';
import ProjectReport from '../components/ProjectReport.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { projectService } from '../services/projectService.js';
import { DOCUMENT_ACCEPT } from '../utils/safeDisplay.js';

const STATUSES = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'En cours' },
  { value: 'paused', label: 'En pause' },
  { value: 'launched', label: 'Lancé' },
  { value: 'archived', label: 'Archivé' },
];

const STAGES = [
  { value: 'idee', label: 'Informations générales' },
  { value: 'etude_marche', label: 'Étude de marché' },
  { value: 'business_plan', label: 'Business plan' },
  { value: 'financement', label: 'Financement' },
  { value: 'immatriculation', label: 'Immatriculation' },
  { value: 'lancement', label: 'Lancement' },
];

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { logout } = useAuth();
  const { setCurrentProjectId } = useProject();
  const fileInputRef = useRef(null);

  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [proj, docs] = await Promise.all([
        projectService.getProject(id),
        projectService.listDocuments(id),
      ]);
      setProject(proj);
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      setError(err.message || 'Projet introuvable');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) setCurrentProjectId(id);
    load();
  }, [id, load, setCurrentProjectId]);

  const saveLifecycle = async (fields) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await projectService.updateProject(id, fields);
      setProject(updated);
      setMessage('Projet mis à jour.');
    } catch (err) {
      setError(err.message || 'Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Sélectionnez un fichier.');
      return;
    }
    setUploading(true);
    setMessage('');
    setError('');
    try {
      await projectService.uploadDocument(id, file);
      fileInputRef.current.value = '';
      await load();
      setMessage('Document ajouté.');
    } catch (err) {
      setError(err.message || 'Échec du téléversement');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    setMessage('');
    setError('');
    try {
      await projectService.deleteDocument(id, docId);
      setDocuments((docs) => docs.filter((d) => d.id !== docId));
      setMessage('Document supprimé.');
    } catch (err) {
      setError(err.message || 'Échec de la suppression');
    }
  };

  if (loading) {
    return (
      <AppShell onLogout={logout}>
        <p className="text-prune-500">Chargement...</p>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell onLogout={logout}>
        <p className="alert-error">{error || 'Projet introuvable'}</p>
        <Link to="/" className="link-accent mt-4 inline-block">Retour à l&apos;accueil</Link>
      </AppShell>
    );
  }

  return (
    <AppShell onLogout={logout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-prune-600 uppercase">
              Informations générales
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-prune-900">
              {project.title || project.quoi}
            </h1>
          </div>
          <Link to="/parcours" className="btn-secondary text-center text-sm">
            Retour
          </Link>
        </div>

        {error && <p className="alert-error">{error}</p>}
        {message && <p className="alert-success">{message}</p>}

        <ProjectReport project={project} />

        <div className="card p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field" htmlFor="status">Statut</label>
            <select
              id="status"
              className="input-field"
              value={project.status}
              disabled={saving}
              onChange={(e) => saveLifecycle({ status: e.target.value })}
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="stage">Étape</label>
            <select
              id="stage"
              className="input-field"
              value={project.stage}
              disabled={saving}
              onChange={(e) => saveLifecycle({ stage: e.target.value })}
            >
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-prune-900">Documents</h2>

          <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="text-sm text-prune-700 file:mr-3 file:rounded-lg file:border-0 file:bg-prune-100 file:px-3 file:py-2 file:text-prune-700"
            />
            <Button type="submit" disabled={uploading} className="w-auto text-sm">
              {uploading ? 'Envoi...' : 'Téléverser'}
            </Button>
          </form>

          {documents.length === 0 ? (
            <p className="text-sm text-prune-500">Aucun document pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-prune-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-prune-900 truncate">{doc.title || doc.fileName}</p>
                    <p className="text-xs text-prune-500">
                      {doc.type} · {formatSize(doc.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <a
                      href={projectService.documentDownloadUrl(id, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-topaz-600 hover:underline"
                    >
                      Ouvrir
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

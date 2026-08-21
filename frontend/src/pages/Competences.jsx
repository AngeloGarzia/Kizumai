import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  RECORD_STATUS_OPTIONS,
  RECORD_TYPE_OPTIONS,
  learningService,
} from '../services/learningService.js';
import { useProject } from '../context/ProjectContext.jsx';

const EMPTY_FORM = {
  recordType: 'formation',
  title: '',
  organization: '',
  status: 'envisage',
  level: '',
  field: '',
  skills: '',
  notes: '',
};

export default function Competences() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid } = useAuth();
  const { currentProjectId } = useProject();
  const [records, setRecords] = useState([]);
  const projectId = currentProjectId;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await learningService.list(projectId ? { projectId } : {});
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les compétences');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isAuthenticated || !isPaid) {
      navigate('/login', { state: { from: '/competences' } });
      return;
    }
    load();
  }, [isAuthenticated, isPaid, navigate, load]);

  const startEdit = (record) => {
    setEditingId(record.id);
    setForm({
      recordType: record.recordType || 'formation',
      title: record.title || '',
      organization: record.organization || '',
      status: record.status || 'envisage',
      level: record.level || '',
      field: record.field || '',
      skills: Array.isArray(record.skills) ? record.skills.join(', ') : '',
      notes: record.notes || '',
    });
    setMessage('');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        recordType: form.recordType,
        title: form.title.trim(),
        organization: form.organization.trim() || null,
        status: form.status,
        level: form.level.trim() || null,
        field: form.field.trim() || null,
        notes: form.notes.trim() || null,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        projectId: projectId || null,
      };
      if (editingId) {
        await learningService.update(editingId, payload);
        setMessage('Compétence mise à jour');
      } else {
        await learningService.create(payload);
        setMessage('Compétence ajoutée');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer cette entrée ?')) return;
    setBusy(true);
    try {
      await learningService.remove(id);
      await load();
      setMessage('Entrée supprimée');
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = (value) =>
    RECORD_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
  const statusLabel = (value) =>
    RECORD_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        <header className="sticky top-0 z-10 header-glass">
          <div className="page-container py-4 sm:py-5 flex items-center justify-between gap-3">
            <BrandLogo size="sm" />
            <Link to="/" className="text-sm font-semibold text-topaz-600">
              Accueil
            </Link>
          </div>
        </header>

        <main className="page-container flex-1 space-y-6 max-w-[50.4rem] lg:max-w-[67.2rem]">
          <section className="pt-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-prune-900">Mes compétences</h1>
            <p className="mt-2 text-sm text-prune-500">
              Formations, diplômes et bilans liés à ton projet.
            </p>
          </section>

          {error && <p className="alert-error">{error}</p>}
          {message && <p className="alert-success">{message}</p>}

          <form onSubmit={save} className="rounded-2xl bg-white/80 border border-prune-100 p-4 sm:p-5 space-y-3">
            <h2 className="text-lg font-bold text-prune-900">
              {editingId ? 'Modifier' : 'Ajouter'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label-field" htmlFor="recordType">Type</label>
                <select
                  id="recordType"
                  className="input-field"
                  value={form.recordType}
                  onChange={(e) => setForm((f) => ({ ...f, recordType: e.target.value }))}
                >
                  {RECORD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="status">Statut</label>
                <select
                  id="status"
                  className="input-field"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {RECORD_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Input
                id="title"
                label="Titre"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Input
                id="organization"
                label="Organisme"
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              />
              <Input
                id="level"
                label="Niveau"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              />
              <Input
                id="field"
                label="Domaine"
                value={form.field}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
              />
            </div>
            <Input
              id="skills"
              label="Compétences (séparées par des virgules)"
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
            />
            <div>
              <label className="label-field" htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                className="input-field min-h-[5rem]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy} className="w-auto">
                {busy ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" className="w-auto" onClick={resetForm}>
                  Annuler
                </Button>
              )}
            </div>
          </form>

          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-prune-600 uppercase">
              Tes entrées
            </h2>
            {loading ? (
              <p className="text-prune-500 text-sm">Chargement…</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-prune-500">Aucune compétence enregistrée pour l’instant.</p>
            ) : (
              <ul className="space-y-3">
                {records.map((record) => (
                  <li
                    key={record.id}
                    className="rounded-2xl bg-white border border-prune-100 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-topaz-600">
                          {typeLabel(record.recordType)} · {statusLabel(record.status)}
                        </p>
                        <h3 className="font-semibold text-prune-900 truncate">{record.title}</h3>
                        {record.organization && (
                          <p className="text-sm text-prune-500">{record.organization}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="text-sm text-topaz-600 font-semibold"
                          onClick={() => startEdit(record)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="text-sm text-prune-400"
                          onClick={() => remove(record.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    {Array.isArray(record.skills) && record.skills.length > 0 && (
                      <p className="text-xs text-prune-600">
                        {record.skills.join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

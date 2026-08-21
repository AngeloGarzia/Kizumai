import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { projectService } from '../services/projectService.js';
import { geoPercent } from '../utils/moduleProgress.js';

const EMPTY = {
  label: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  region: '',
  department: '',
  country: 'FR',
  latitude: '',
  longitude: '',
};

export default function Geographie() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid } = useAuth();
  const { currentProject, refreshProjects } = useProject();
  const [project, setProject] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = currentProject || null;
      setProject(current);
      if (current) {
        const loc = current.location || {};
        setForm({
          label: current.ou || loc.label || '',
          addressLine1: loc.addressLine1 || '',
          addressLine2: loc.addressLine2 || '',
          postalCode: loc.postalCode || '',
          city: loc.city || '',
          region: loc.region || '',
          department: loc.department || '',
          country: loc.country || 'FR',
          latitude: loc.latitude != null ? String(loc.latitude) : '',
          longitude: loc.longitude != null ? String(loc.longitude) : '',
        });
      }
    } catch (err) {
      setError(err.message || 'Impossible de charger le lieu');
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (!isAuthenticated || !isPaid) {
      navigate('/login', { state: { from: '/geographie' } });
      return;
    }
    load();
  }, [isAuthenticated, isPaid, navigate, load]);

  const save = async (e) => {
    e.preventDefault();
    if (!project?.id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await projectService.updateProjectLocation(project.id, {
        label: form.label.trim(),
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        postalCode: form.postalCode.trim() || null,
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        department: form.department.trim() || null,
        country: form.country.trim() || 'FR',
        latitude: form.latitude.trim() || null,
        longitude: form.longitude.trim() || null,
      });
      setProject(updated);
      setMessage('Lieu enregistré');
      await refreshProjects();
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setBusy(false);
    }
  };

  const percent = geoPercent(project);

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
            <h1 className="text-2xl sm:text-3xl font-bold text-prune-900">Gestion géographique</h1>
            <p className="mt-2 text-sm text-prune-500">
              Lieu d’implantation de ton projet — {percent}% complété.
            </p>
          </section>

          {error && <p className="alert-error">{error}</p>}
          {message && <p className="alert-success">{message}</p>}

          {loading ? (
            <p className="text-prune-500 text-sm">Chargement…</p>
          ) : !project ? (
            <div className="rounded-2xl bg-white/80 border border-prune-100 p-5 space-y-3">
              <p className="text-sm text-prune-600">
                Crée d’abord un projet pour définir son ancrage géographique.
              </p>
              <Link to="/creer-son-avenir" className="btn-primary inline-flex w-auto">
                Créer son avenir
              </Link>
            </div>
          ) : (
            <form onSubmit={save} className="rounded-2xl bg-white/80 border border-prune-100 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-prune-500">
                Projet : <strong className="text-prune-900">{project.title || project.quoi}</strong>
              </p>
              <Input
                id="label"
                label="Libellé du lieu"
                required
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
              <Input
                id="addressLine1"
                label="Adresse"
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
              <Input
                id="addressLine2"
                label="Complément"
                value={form.addressLine2}
                onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  id="postalCode"
                  label="Code postal"
                  value={form.postalCode}
                  onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                />
                <Input
                  id="city"
                  label="Ville"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
                <Input
                  id="department"
                  label="Département"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  id="region"
                  label="Région"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
                <Input
                  id="latitude"
                  label="Latitude"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
                <Input
                  id="longitude"
                  label="Longitude"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-auto">
                {busy ? 'Enregistrement…' : 'Enregistrer le lieu'}
              </Button>
            </form>
          )}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { authService } from '../services/authService.js';
import { userService } from '../services/userService.js';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function planLabel(plan, role) {
  if (role === 'admin') return 'Administrateur';
  if (plan === 'paid') return 'Payant';
  return 'Gratuit';
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrateur';
  return 'Utilisateur';
}

export default function Setup() {
  const navigate = useNavigate();
  const { user, isPaid, isAdmin, logout, loadUser } = useAuth();
  const { projects, hasProject } = useProject();

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [nameError, setNameError] = useState('');

  const [billingConfig, setBillingConfig] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    let active = true;
    authService.getBillingConfig()
      .then((config) => {
        if (active) setBillingConfig(config);
      })
      .catch(() => {
        if (active) setBillingConfig({ selfServePaidEnabled: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveName = async (event) => {
    event.preventDefault();
    if (!user?.id) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Le nom doit contenir au moins 2 caractères.');
      setNameMessage('');
      return;
    }

    setSavingName(true);
    setNameError('');
    setNameMessage('');

    try {
      await userService.update(user.id, { name: trimmed });
      await loadUser();
      setNameMessage('Nom mis à jour.');
    } catch (err) {
      setNameError(err.message || 'Impossible de mettre à jour le nom');
    } finally {
      setSavingName(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError('');
    try {
      await authService.upgradeToPaid();
      await loadUser();
    } catch (err) {
      setUpgradeError(err.message || "Impossible d'activer le compte payant");
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = async () => {
    setSessionBusy(true);
    setSessionMessage('');
    try {
      await logout();
      navigate('/');
    } finally {
      setSessionBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Déconnecter ce compte sur tous les appareils ?')) return;

    setSessionBusy(true);
    setSessionMessage('');
    try {
      await authService.logoutAll();
      await logout();
      navigate('/');
    } catch (err) {
      setSessionMessage(err.message || 'Impossible de déconnecter tous les appareils');
      setSessionBusy(false);
    }
  };

  const canSelfUpgrade = Boolean(billingConfig?.selfServePaidEnabled) && !isPaid && !isAdmin;

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:self-start lg:h-screen lg:shrink-0">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        <main className="page-container flex-1 space-y-6 sm:space-y-8 max-w-[50.4rem] lg:max-w-[67.2rem] py-6 sm:py-8">
          <section className="space-y-2">
            <BrandLogo size="sm" asLink={false} />
            <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
              Paramètres
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-prune-900">Setup</h1>
            <p className="text-sm text-prune-600">
              Informations de votre compte et préférences liées à votre profil.
            </p>
          </section>

          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-prune-800">Informations du compte</h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                ['Identifiant', user?.id],
                ['Email', user?.email],
                ['Rôle', roleLabel(user?.role)],
                ['Plan', planLabel(user?.plan, user?.role)],
                ['Compte créé', formatDate(user?.createdAt)],
                ['Dernière mise à jour', formatDate(user?.updatedAt)],
                ...(isPaid ? [['Projets', hasProject ? projects.length : 0]] : []),
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-prune-50 px-3 py-2">
                  <dt className="text-xs text-prune-500">{label}</dt>
                  <dd className="font-medium text-prune-900 break-all">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>

            <form onSubmit={handleSaveName} className="space-y-3 pt-2 border-t border-prune-100">
              <Input
                id="setup-name"
                label="Nom affiché"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
              />
              {nameError && <p className="alert-error">{nameError}</p>}
              {nameMessage && <p className="alert-success">{nameMessage}</p>}
              <Button type="submit" disabled={savingName || name.trim() === (user?.name || '')}>
                {savingName ? 'Enregistrement...' : 'Enregistrer le nom'}
              </Button>
            </form>
          </section>

          <section className="card p-5 sm:p-6 space-y-3">
            <h2 className="text-sm font-bold text-prune-800">Abonnement</h2>
            {isPaid ? (
              <p className="text-sm text-prune-700">
                Votre compte inclut l&apos;accès au parcours complet Kizumai.
              </p>
            ) : (
              <>
                <p className="text-sm text-prune-700">
                  Votre compte est en accès gratuit. Le parcours complet nécessite un compte payant.
                </p>
                {upgradeError && <p className="alert-error">{upgradeError}</p>}
                {canSelfUpgrade ? (
                  <Button type="button" onClick={handleUpgrade} disabled={upgrading}>
                    {upgrading ? 'Activation...' : 'Passer en compte payant'}
                  </Button>
                ) : (
                  <p className="text-xs text-prune-500">
                    L&apos;auto-activation payante n&apos;est pas disponible. Contactez l&apos;équipe si besoin.
                  </p>
                )}
                <Link to="/projet/apercu" className="link-accent text-sm inline-block">
                  Voir mon projet en cours
                </Link>
              </>
            )}
          </section>

          <NotificationSettings className="mt-0" />

          <section className="card p-5 sm:p-6 space-y-3">
            <h2 className="text-sm font-bold text-prune-800">Session</h2>
            <p className="text-sm text-prune-600">
              Déconnectez-vous de cet appareil ou de tous vos appareils connectés.
            </p>
            {sessionMessage && <p className="alert-error">{sessionMessage}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={handleLogout} disabled={sessionBusy}>
                {sessionBusy ? '...' : 'Déconnexion'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleLogoutAll} disabled={sessionBusy}>
                Déconnexion de tous les appareils
              </Button>
            </div>
          </section>
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

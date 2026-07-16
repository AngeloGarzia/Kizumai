import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import Button from '../components/Button.jsx';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'settings', label: 'Paramètres IA' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'connections', label: 'Connexions' },
  { id: 'notifications', label: 'Notifications' },
];

export default function Admin() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [settings, setSettings] = useState({
    aiProvider: 'gemini',
    aiModel: '',
    aiTemperature: '0.7',
    providers: [],
  });
  const [prompts, setPrompts] = useState([]);
  const [usersOverview, setUsersOverview] = useState(null);
  const [connections, setConnections] = useState([]);
  const [broadcast, setBroadcast] = useState({ title: '', body: '', url: '' });
  const [broadcasting, setBroadcasting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    // Chaque jeu de données est chargé indépendamment : l'échec d'un endpoint
    // ne doit pas rendre tout le panneau inutilisable.
    const [settingsRes, promptsRes, usersRes, connectionsRes] = await Promise.allSettled([
      adminService.getSettings(),
      adminService.getPrompts(),
      adminService.getUsers(),
      adminService.getConnections(),
    ]);

    if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);
    if (promptsRes.status === 'fulfilled') setPrompts(promptsRes.value);
    if (usersRes.status === 'fulfilled') setUsersOverview(usersRes.value);
    if (connectionsRes.status === 'fulfilled') setConnections(connectionsRes.value);

    const failed = [settingsRes, promptsRes, usersRes, connectionsRes]
      .filter((r) => r.status === 'rejected');
    if (failed.length) {
      setError(failed[0].reason?.message || 'Certaines données n\'ont pas pu être chargées');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProvider = settings.providers.find((p) => p.id === settings.aiProvider);
  const availableModels = selectedProvider?.models ?? [];

  const handleProviderChange = (providerId) => {
    const provider = settings.providers.find((p) => p.id === providerId);
    setSettings({
      ...settings,
      aiProvider: providerId,
      aiModel: provider?.defaultModel || settings.aiModel,
    });
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const updated = await adminService.updateSettings(settings);
      setSettings(updated);
      setMessage('Paramètres enregistrés');
    } catch (err) {
      setError(err.message);
    }
  };

  const savePrompt = async (prompt) => {
    setMessage('');
    try {
      await adminService.updatePrompt(prompt.key, {
        name: prompt.name,
        content: prompt.content,
        role: prompt.role,
      });
      setMessage(`Prompt « ${prompt.name} » enregistré`);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBroadcasting(true);
    try {
      const summary = await adminService.broadcastNotification(broadcast);
      setMessage(
        `Notification envoyée : ${summary.push} push, ${summary.email} email (sur ${summary.recipients} destinataires).`
      );
      setBroadcast({ title: '', body: '', url: '' });
    } catch (err) {
      setError(err.message || 'Échec de l\'envoi');
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await adminService.updateUserRole(user.id, nextRole);
      await loadData();
      setMessage(`Rôle de ${user.email} mis à jour`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AppShell onLogout={logout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-prune-600 uppercase">Administration</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-prune-900">Panneau administrateur</h1>
            <p className="text-sm text-prune-500 mt-1">
              L&apos;administrateur hérite de tous les droits utilisateur.
            </p>
          </div>
          <Link to="/dashboard" className="btn-secondary text-center text-sm">
            Retour au tableau de bord
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                ${tab === item.id
                  ? 'bg-prune-900 text-white'
                  : 'bg-white border border-prune-100 text-prune-600 hover:bg-prune-50'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="alert-error">{error}</p>}
        {message && <p className="alert-success">{message}</p>}

        {loading ? (
          <p className="text-prune-500">Chargement...</p>
        ) : (
          <>
            {tab === 'settings' && (
              <form onSubmit={saveSettings} className="card p-5 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-prune-900">Moteur IA</h2>
                  <p className="text-sm text-prune-500 mt-1">
                    Choisissez le fournisseur et le modèle utilisés pour compléter les projets.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.providers.map((provider) => (
                    <div
                      key={provider.id}
                      className={`rounded-xl border px-4 py-3 text-sm
                        ${provider.configured
                          ? 'border-wasabi-200 bg-wasabi-50 text-wasabi-800'
                          : 'border-prune-200 bg-prune-50 text-prune-500'}`}
                    >
                      <p className="font-semibold text-prune-900">{provider.name}</p>
                      <p className="text-xs mt-1">
                        {provider.configured ? 'Clé API configurée' : 'Clé API absente du .env'}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="label-field" htmlFor="aiProvider">Fournisseur</label>
                  <select
                    id="aiProvider"
                    className="input-field"
                    value={settings.aiProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                  >
                    {settings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                        {provider.name}{provider.configured ? '' : ' (non configuré)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-field" htmlFor="aiModel">Modèle</label>
                  <select
                    id="aiModel"
                    className="input-field"
                    value={settings.aiModel}
                    onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                  >
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-field" htmlFor="aiTemperature">Température</label>
                  <input
                    id="aiTemperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className="input-field"
                    value={settings.aiTemperature}
                    onChange={(e) => setSettings({ ...settings, aiTemperature: e.target.value })}
                  />
                </div>

                {!selectedProvider?.configured && (
                  <p className="alert-error">
                    Le fournisseur sélectionné n&apos;a pas de clé API. Ajoutez-la dans le fichier
                    {' '}<code className="text-xs">backend/.env.development</code> puis redémarrez le serveur.
                  </p>
                )}

                <Button type="submit">Enregistrer les paramètres</Button>
              </form>
            )}

            {tab === 'prompts' && (
              <div className="space-y-4">
                <p className="text-sm text-prune-600">
                  Les prompts en base pilotent entièrement le comportement de l&apos;IA.
                  Variables utiles selon l&apos;étape :{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{quoi}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{ou}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{business}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{business_activity}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{business_pitch}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{location}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{budget}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{refine}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{avoid}}'}</code>,{' '}
                  <code className="text-xs bg-prune-100 px-1 rounded">{'{{count}}'}</code>.
                </p>
                {prompts.map((prompt) => (
                  <div key={prompt.key} className="card p-5 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h3 className="font-semibold text-prune-900">{prompt.name}</h3>
                      <span className="text-xs text-prune-500">{prompt.key} · {prompt.role}</span>
                    </div>
                    <textarea
                      className="input-field min-h-[140px] resize-y font-mono text-sm"
                      value={prompt.content}
                      onChange={(e) => {
                        const next = prompts.map((p) =>
                          p.key === prompt.key ? { ...p, content: e.target.value } : p
                        );
                        setPrompts(next);
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => savePrompt(prompts.find((p) => p.key === prompt.key))}
                      className="w-auto text-sm"
                    >
                      Enregistrer ce prompt
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'users' && usersOverview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['Total', usersOverview.totals.all],
                    ['Utilisateurs', usersOverview.totals.users],
                    ['Administrateurs', usersOverview.totals.admins],
                  ].map(([label, value]) => (
                    <div key={label} className="card p-4 text-center">
                      <p className="text-xs text-prune-500 uppercase">{label}</p>
                      <p className="text-2xl font-bold text-prune-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-prune-50 text-left">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-prune-700">Nom</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Email</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Rôle</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersOverview.users.map((user) => (
                          <tr key={user.id} className="border-t border-prune-100">
                            <td className="px-4 py-3">{user.name}</td>
                            <td className="px-4 py-3">{user.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold
                                ${user.role === 'admin'
                                  ? 'bg-wasabi-100 text-wasabi-800'
                                  : 'bg-prune-100 text-prune-700'}`}
                              >
                                {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleRole(user)}
                                className="text-xs font-semibold text-topaz-600 hover:underline"
                              >
                                {user.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'connections' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-prune-50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-prune-700">Date</th>
                        <th className="px-4 py-3 font-semibold text-prune-700">Email</th>
                        <th className="px-4 py-3 font-semibold text-prune-700">Action</th>
                        <th className="px-4 py-3 font-semibold text-prune-700">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connections.map((conn) => (
                        <tr key={conn.id} className="border-t border-prune-100">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(conn.createdAt).toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3">{conn.email || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-prune-100 text-prune-700 text-xs font-medium">
                              {conn.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-prune-500">{conn.ipAddress || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <form onSubmit={sendBroadcast} className="card p-5 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-prune-900">Notification à tous les utilisateurs</h2>
                  <p className="text-sm text-prune-500 mt-1">
                    Envoi par push aux appareils abonnés, et par email aux utilisateurs sans abonnement
                    (notamment iOS non installé).
                  </p>
                </div>

                <div>
                  <label className="label-field" htmlFor="notifTitle">Titre</label>
                  <input
                    id="notifTitle"
                    className="input-field"
                    value={broadcast.title}
                    onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
                    required
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className="label-field" htmlFor="notifBody">Message</label>
                  <textarea
                    id="notifBody"
                    className="input-field min-h-[100px] resize-y"
                    value={broadcast.body}
                    onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })}
                    required
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="label-field" htmlFor="notifUrl">Lien (optionnel)</label>
                  <input
                    id="notifUrl"
                    className="input-field"
                    placeholder="/dashboard"
                    value={broadcast.url}
                    onChange={(e) => setBroadcast({ ...broadcast, url: e.target.value })}
                  />
                </div>

                <Button type="submit" disabled={broadcasting}>
                  {broadcasting ? 'Envoi...' : 'Envoyer la notification'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

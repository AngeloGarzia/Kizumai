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
];

export default function Admin() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [settings, setSettings] = useState({ aiModel: '', aiTemperature: '0.7' });
  const [prompts, setPrompts] = useState([]);
  const [usersOverview, setUsersOverview] = useState(null);
  const [connections, setConnections] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsData, promptsData, usersData, connectionsData] = await Promise.all([
        adminService.getSettings(),
        adminService.getPrompts(),
        adminService.getUsers(),
        adminService.getConnections(),
      ]);
      setSettings(settingsData);
      setPrompts(promptsData);
      setUsersOverview(usersData);
      setConnections(connectionsData);
    } catch (err) {
      setError(err.message || 'Impossible de charger l\'administration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
            <p className="text-xs font-semibold tracking-widest text-topaz-600 uppercase">Administration</p>
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
                  ? 'bg-prune-900 text-wasabi-400'
                  : 'bg-white border border-prune-100 text-prune-600 hover:bg-prune-50'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="alert-error">{error}</p>}
        {message && (
          <p className="text-sm text-wasabi-700 bg-wasabi-50 border border-wasabi-200 px-4 py-3 rounded-xl">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-prune-500">Chargement...</p>
        ) : (
          <>
            {tab === 'settings' && (
              <form onSubmit={saveSettings} className="card p-5 sm:p-8 space-y-4">
                <h2 className="text-lg font-bold text-prune-900">Modèle IA</h2>
                <div>
                  <label className="label-field" htmlFor="aiModel">Modèle</label>
                  <input
                    id="aiModel"
                    className="input-field"
                    value={settings.aiModel}
                    onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                  />
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
                <Button type="submit">Enregistrer les paramètres</Button>
              </form>
            )}

            {tab === 'prompts' && (
              <div className="space-y-4">
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
                    <button
                      type="button"
                      onClick={() => savePrompt(prompts.find((p) => p.key === prompt.key))}
                      className="btn-secondary text-sm"
                    >
                      Enregistrer ce prompt
                    </button>
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
                                  ? 'bg-topaz-100 text-topaz-800'
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
                            <span className="px-2 py-1 rounded-lg bg-azure-50 text-azure-700 text-xs font-medium">
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
          </>
        )}
      </div>
    </AppShell>
  );
}

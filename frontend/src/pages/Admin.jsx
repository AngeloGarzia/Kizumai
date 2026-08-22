import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import Button from '../components/Button.jsx';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'settings', label: 'Paramètres' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'connections', label: 'Connexions' },
  { id: 'notifications', label: 'Notifications' },
];

const SETUP_SECTIONS = [
  {
    id: 'memory',
    title: 'Mémoire projet',
    description:
      'Paramètres communs à tous les projets. Les seuils s’appliquent immédiatement ; les crons nécessitent un redémarrage du serveur.',
    keys: [
      {
        key: 'memory_archive_threshold',
        label: 'Seuil d’archivage',
        hint: 'Importance en dessous de laquelle un souvenir est archivé (ex. 0.05)',
      },
      {
        key: 'memory_snapshot_event_threshold',
        label: 'Seuil d’événements (snapshot)',
        hint: 'Nombre d’événements avant régénération du snapshot',
      },
      {
        key: 'memory_snapshot_max_age_hours',
        label: 'Âge max snapshot (heures)',
      },
      {
        key: 'memory_snapshot_top_nodes',
        label: 'Top nœuds pour snapshot',
      },
      {
        key: 'memory_recall_max_chars',
        label: 'Taille max du rappel (caractères)',
      },
      {
        key: 'memory_graph_depth',
        label: 'Profondeur du graphe',
      },
      {
        key: 'memory_recall_node_limit',
        label: 'Limite de nœuds au rappel',
      },
      {
        key: 'memory_default_decay_rate',
        label: 'Taux de décroissance par défaut',
      },
      {
        key: 'memory_decay_cron',
        label: 'Cron décroissance',
        hint: 'Expression cron — redémarrer le backend après modification',
      },
      {
        key: 'memory_snapshot_cron',
        label: 'Cron snapshot',
        hint: 'Expression cron — redémarrer le backend après modification',
      },
    ],
  },
  {
    id: 'business',
    title: 'Règles métier',
    description: 'Bornes budget et règles communes à tous les utilisateurs.',
    keys: [
      {
        key: 'budget_eur_min',
        label: 'Budget min (EUR)',
        hint: 'Borne basse convertie dans la devise du projet',
      },
      {
        key: 'budget_eur_max',
        label: 'Budget max (EUR)',
      },
      {
        key: 'business_project_suggestions_count',
        label: 'Nombre de projets business proposés',
        hint: 'Entier entre 1 et 8 — utilisé dans le prompt {{count}}',
        defaultValue: '3',
      },
    ],
  },
  {
    id: 'features',
    title: 'Fonctionnalités',
    description:
      'Flags non secrets. Si ALLOW_SELF_SERVE_PAID est défini dans l’environnement, il prime sur cette valeur.',
    keys: [
      {
        key: 'self_serve_paid_enabled',
        label: 'Passage payant sans paiement',
        hint: 'true / false — autorise l’auto-activation du plan payant',
        defaultValue: 'false',
      },
    ],
  },
];

const PROTECTED_KEYS = new Set([
  'ai_provider',
  'ai_model',
  'ai_temperature',
  'budget_eur_min',
  'budget_eur_max',
  'business_project_suggestions_count',
]);

const PROMPT_GROUPS = [
  {
    id: 'parcours',
    title: 'Parcours / recherche',
    keys: ['idee_system', 'project_user', 'lieux', 'budget', 'formation'],
  },
  {
    id: 'docs',
    title: 'Documents',
    keys: ['document_scan'],
  },
  {
    id: 'memory',
    title: 'Mémoire',
    keys: ['memory_snapshot', 'memory_recall'],
  },
];

function settingMap(settings) {
  const map = {};
  for (const row of settings) map[row.key] = row;
  return map;
}

function SettingRow({ def, row, busyKey, onChange, onSave, onRemove }) {
  const value = row?.value ?? def.defaultValue ?? '';
  const exists = Boolean(row);
  return (
    <li className="grid grid-cols-1 lg:grid-cols-[minmax(12rem,16rem)_1fr_auto] gap-2 lg:items-end border-b border-prune-50 pb-3 last:border-0">
      <div>
        <p className="text-sm font-semibold text-prune-900">{def.label}</p>
        <p className="text-xs text-prune-400 font-mono">{def.key}</p>
        {def.hint && <p className="text-xs text-prune-500 mt-1">{def.hint}</p>}
      </div>
      <input
        className="input-field font-mono text-sm"
        value={value}
        onChange={(e) => onChange(def.key, e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          className="w-auto text-sm"
          disabled={busyKey === def.key}
          onClick={() => onSave(def.key, value)}
        >
          {exists ? 'Sauver' : 'Créer'}
        </Button>
        {exists && !PROTECTED_KEYS.has(def.key) && (
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={busyKey === def.key}
            onClick={() => onRemove(def.key)}
          >
            Suppr.
          </button>
        )}
      </div>
    </li>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : 'settings';

  const setTab = (id) => {
    setSearchParams(id === 'settings' ? {} : { tab: id }, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const [ai, setAi] = useState({
    aiProvider: 'gemini',
    aiModel: '',
    aiTemperature: '0.7',
    providers: [],
  });
  const [settings, setSettings] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState('');
  const [aiTestResult, setAiTestResult] = useState(null);
  const [newSetting, setNewSetting] = useState({ key: '', value: '' });

  const [usersOverview, setUsersOverview] = useState(null);
  const [connections, setConnections] = useState([]);
  const [broadcast, setBroadcast] = useState({ title: '', body: '', url: '' });
  const [broadcasting, setBroadcasting] = useState(false);

  const byKey = useMemo(() => settingMap(settings), [settings]);
  const catalogKeys = useMemo(
    () => new Set(SETUP_SECTIONS.flatMap((s) => s.keys.map((k) => k.key))),
    []
  );
  const advancedSettings = useMemo(
    () =>
      settings.filter(
        (s) =>
          !catalogKeys.has(s.key) &&
          !['ai_provider', 'ai_model', 'ai_temperature'].includes(s.key)
      ),
    [settings, catalogKeys]
  );

  const loadSetup = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await adminService.getSetup();
      setAi(data.ai || { providers: [] });
      setSettings(data.settings || []);
      setPrompts(data.prompts || []);
      if (!selectedPromptKey && data.prompts?.[0]) {
        setSelectedPromptKey(data.prompts[0].key);
      }
    } catch (err) {
      setError(err.message || 'Impossible de charger les paramètres');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadOps = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    const [usersRes, connectionsRes] = await Promise.allSettled([
      adminService.getUsers(),
      adminService.getConnections(),
    ]);
    if (usersRes.status === 'fulfilled') setUsersOverview(usersRes.value);
    if (connectionsRes.status === 'fulfilled') setConnections(connectionsRes.value);
    const failed = [usersRes, connectionsRes].filter((r) => r.status === 'rejected');
    if (failed.length) {
      setError(failed[0].reason?.message || 'Certaines données n\'ont pas pu être chargées');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (tab === 'settings') loadSetup();
    else loadOps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectedProvider = ai.providers?.find((p) => p.id === ai.aiProvider);
  const availableModels = selectedProvider?.models ?? [];
  const modelsStatus = useMemo(() => {
    const providers = ai.providers || [];
    const live = providers.filter((p) => p.modelsSource === 'live').length;
    const fallback = providers.filter((p) => p.modelsSource === 'fallback').length;
    return { live, fallback, refreshedAt: ai.modelsRefreshedAt };
  }, [ai.providers, ai.modelsRefreshedAt]);
  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.key === selectedPromptKey) || null,
    [prompts, selectedPromptKey]
  );

  const saveAi = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setBusyKey('ai');
    try {
      const updated = await adminService.updateSettings(ai);
      setAi((prev) => ({ ...prev, ...updated }));
      setMessage('Paramètres IA enregistrés');
      await loadSetup({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const testAiEngine = async () => {
    setMessage('');
    setError('');
    setAiTestResult(null);
    setBusyKey('test-ai');
    try {
      const result = await adminService.testAiEngine(ai);
      setAiTestResult(result);
      setMessage(`Test IA réussi avec ${result.provider} / ${result.model}`);
    } catch (err) {
      setError(err.message || 'Le test du moteur IA a échoué');
    } finally {
      setBusyKey('');
    }
  };

  const setLocalValue = (key, value) => {
    setSettings((list) => {
      const exists = list.some((s) => s.key === key);
      if (exists) return list.map((s) => (s.key === key ? { ...s, value } : s));
      return [...list, { key, value, updatedAt: null }];
    });
  };

  const saveSetting = async (key, value) => {
    setMessage('');
    setError('');
    setBusyKey(key);
    try {
      await adminService.upsertAppSetting(key, value);
      setMessage(`Paramètre « ${key} » enregistré`);
      await loadSetup({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const removeSetting = async (key) => {
    if (!window.confirm(`Supprimer le paramètre « ${key} » ?`)) return;
    setBusyKey(key);
    setError('');
    try {
      await adminService.deleteAppSetting(key);
      setMessage(`Paramètre « ${key} » supprimé`);
      await loadSetup({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const addSetting = async (e) => {
    e.preventDefault();
    await saveSetting(newSetting.key.trim().toLowerCase(), newSetting.value);
    setNewSetting({ key: '', value: '' });
  };

  const savePrompt = async () => {
    if (!selectedPrompt) return;
    setBusyKey(`prompt:${selectedPrompt.key}`);
    setMessage('');
    setError('');
    try {
      await adminService.updatePrompt(selectedPrompt.key, {
        name: selectedPrompt.name,
        role: selectedPrompt.role,
        content: selectedPrompt.content,
      });
      setMessage(`Prompt « ${selectedPrompt.name} » enregistré`);
      await loadSetup({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const updatePromptField = (field, value) => {
    setPrompts((list) =>
      list.map((p) => (p.key === selectedPromptKey ? { ...p, [field]: value } : p))
    );
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
      await loadOps({ silent: true });
      setMessage(`Rôle de ${user.email} mis à jour`);
    } catch (err) {
      setError(err.message);
    }
  };

  const sectionAnchors = [
    { id: 'ai', label: 'Moteur IA' },
    ...SETUP_SECTIONS.map((s) => ({ id: s.id, label: s.title })),
    { id: 'prompts', label: 'Prompts IA' },
    { id: 'advanced', label: 'Avancé' },
  ];

  return (
    <AppShell onLogout={logout}>
      <div className="space-y-6 max-w-[86.4rem]">
        <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-topaz-600 uppercase">
              Administration
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-prune-900">
              Administration
            </h1>
            <p className="mt-2 text-prune-500 max-w-2xl">
              Paramètres communs à tous les utilisateurs, gestion des comptes et notifications.
              Les secrets (clés API, JWT, SMTP…) restent dans l’environnement serveur.
            </p>
          </div>
          <Link to="/" className="btn-secondary text-sm w-auto inline-flex justify-center">
            Accueil
          </Link>
        </section>

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
          <p className="text-prune-500">Chargement…</p>
        ) : (
          <>
            {tab === 'settings' && (
              <div className="space-y-6">
                <nav className="flex flex-wrap gap-2">
                  {sectionAnchors.map((link) => (
                    <a
                      key={link.id}
                      href={`#admin-${link.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-prune-100 text-prune-700 hover:bg-prune-200"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>

                <form
                  id="admin-ai"
                  onSubmit={saveAi}
                  className="rounded-2xl bg-white/80 border border-prune-100 p-5 sm:p-6 space-y-4 scroll-mt-24"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-prune-900">Moteur IA</h2>
                      <p className="text-sm text-prune-500 mt-1">
                        Clés API dans l&apos;environnement ; provider / modèle / température en base.
                      </p>
                      <p className="text-xs text-prune-400 mt-2">
                        {modelsStatus.refreshedAt
                          ? `Listes mises à jour : ${new Date(modelsStatus.refreshedAt).toLocaleString('fr-FR')} — ${modelsStatus.live} live / ${modelsStatus.fallback} repli`
                          : 'Listes de modèles non encore chargées'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-auto shrink-0"
                        disabled={busyKey === 'test-ai'}
                        onClick={testAiEngine}
                      >
                        {busyKey === 'test-ai' ? 'Test en cours…' : 'Tester l’IA choisie'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-auto shrink-0"
                        disabled={busyKey === 'refresh-models'}
                        onClick={async () => {
                          setBusyKey('refresh-models');
                          setError('');
                          try {
                            await loadSetup({ silent: true });
                            setMessage('Listes de modèles rafraîchies');
                          } catch (err) {
                            setError(err.message || 'Échec du rafraîchissement');
                          } finally {
                            setBusyKey('');
                          }
                        }}
                      >
                        {busyKey === 'refresh-models' ? 'Actualisation…' : 'Actualiser les modèles'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label-field" htmlFor="setup-provider">Fournisseur</label>
                      <select
                        id="setup-provider"
                        className="input-field"
                        value={ai.aiProvider}
                        onChange={(e) => {
                          const provider = ai.providers.find((p) => p.id === e.target.value);
                          setAi({
                            ...ai,
                            aiProvider: e.target.value,
                            aiModel: provider?.defaultModel || ai.aiModel,
                          });
                        }}
                      >
                        {(ai.providers || []).map((p) => (
                          <option key={p.id} value={p.id} disabled={!p.configured}>
                            {p.name}
                            {p.configured ? '' : ' (clé absente)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-field" htmlFor="setup-model">Modèle</label>
                      <select
                        id="setup-model"
                        className="input-field"
                        value={ai.aiModel}
                        onChange={(e) => setAi({ ...ai, aiModel: e.target.value })}
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-field" htmlFor="setup-temp">Température</label>
                      <input
                        id="setup-temp"
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        className="input-field"
                        value={ai.aiTemperature}
                        onChange={(e) => setAi({ ...ai, aiTemperature: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={busyKey === 'ai'} className="w-auto">
                    {busyKey === 'ai' ? 'Enregistrement…' : 'Enregistrer l’IA'}
                  </Button>

                  {aiTestResult && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      <p className="font-semibold">Moteur IA opérationnel</p>
                      <p className="mt-1">{aiTestResult.message}</p>
                      <p className="mt-1 text-xs text-emerald-700">
                        Fournisseur : {aiTestResult.provider} — Modèle : {aiTestResult.model} — Temps : {aiTestResult.durationMs} ms
                      </p>
                    </div>
                  )}
                </form>

                {SETUP_SECTIONS.map((section) => (
                  <section
                    key={section.id}
                    id={`admin-${section.id}`}
                    className="rounded-2xl bg-white/80 border border-prune-100 p-5 sm:p-6 space-y-4 scroll-mt-24"
                  >
                    <div>
                      <h2 className="text-lg font-bold text-prune-900">{section.title}</h2>
                      <p className="text-sm text-prune-500 mt-1">{section.description}</p>
                    </div>
                    <ul className="space-y-3">
                      {section.keys.map((def) => (
                        <SettingRow
                          key={def.key}
                          def={def}
                          row={byKey[def.key]}
                          busyKey={busyKey}
                          onChange={setLocalValue}
                          onSave={saveSetting}
                          onRemove={removeSetting}
                        />
                      ))}
                    </ul>
                  </section>
                ))}

                <section
                  id="admin-prompts"
                  className="rounded-2xl bg-white/80 border border-prune-100 p-5 sm:p-6 space-y-4 scroll-mt-24"
                >
                  <div>
                    <h2 className="text-lg font-bold text-prune-900">Prompts IA</h2>
                    <p className="text-sm text-prune-500 mt-1">
                      Contenu 100 % en base — appliqué à tous les utilisateurs.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PROMPT_GROUPS.map((group) => (
                      <div key={group.id} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-prune-500 uppercase mr-1">
                          {group.title}
                        </span>
                        {group.keys.map((key) => {
                          const p = prompts.find((x) => x.key === key);
                          if (!p) return null;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedPromptKey(key)}
                              className={[
                                'text-xs font-semibold px-2.5 py-1 rounded-full border',
                                selectedPromptKey === key
                                  ? 'border-wasabi-500 bg-wasabi-50 text-prune-900'
                                  : 'border-prune-200 text-prune-600 hover:border-prune-400',
                              ].join(' ')}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="label-field" htmlFor="prompt-select">Prompt</label>
                    <select
                      id="prompt-select"
                      className="input-field"
                      value={selectedPromptKey}
                      onChange={(e) => setSelectedPromptKey(e.target.value)}
                    >
                      {prompts.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name} ({p.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPrompt && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label-field" htmlFor="prompt-name">Nom</label>
                          <input
                            id="prompt-name"
                            className="input-field"
                            value={selectedPrompt.name}
                            onChange={(e) => updatePromptField('name', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label-field" htmlFor="prompt-role">Rôle</label>
                          <select
                            id="prompt-role"
                            className="input-field"
                            value={selectedPrompt.role}
                            onChange={(e) => updatePromptField('role', e.target.value)}
                          >
                            <option value="system">system</option>
                            <option value="user">user</option>
                            <option value="assistant">assistant</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label-field" htmlFor="prompt-content">Contenu</label>
                        <textarea
                          id="prompt-content"
                          className="input-field min-h-[220px] resize-y font-mono text-sm"
                          value={selectedPrompt.content}
                          onChange={(e) => updatePromptField('content', e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-auto"
                        disabled={busyKey === `prompt:${selectedPrompt.key}`}
                        onClick={savePrompt}
                      >
                        Enregistrer ce prompt
                      </Button>
                    </div>
                  )}
                </section>

                <section
                  id="admin-advanced"
                  className="rounded-2xl bg-white/80 border border-prune-100 p-5 sm:p-6 space-y-4 scroll-mt-24"
                >
                  <div>
                    <h2 className="text-lg font-bold text-prune-900">Avancé</h2>
                    <p className="text-sm text-prune-500 mt-1">
                      Autres clés{' '}
                      <code className="text-xs bg-prune-100 px-1 rounded">app_settings</code>{' '}
                      hors catalogue, et ajout libre.
                    </p>
                  </div>

                  {advancedSettings.length > 0 ? (
                    <ul className="space-y-3">
                      {advancedSettings.map((row) => (
                        <SettingRow
                          key={row.key}
                          def={{ key: row.key, label: row.key }}
                          row={row}
                          busyKey={busyKey}
                          onChange={setLocalValue}
                          onSave={saveSetting}
                          onRemove={removeSetting}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-prune-500">Aucune clé hors catalogue.</p>
                  )}

                  <form onSubmit={addSetting} className="pt-2 border-t border-prune-100 space-y-3">
                    <h3 className="font-semibold text-prune-900">Ajouter un paramètre</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
                      <input
                        className="input-field font-mono text-sm"
                        placeholder="ma_cle"
                        value={newSetting.key}
                        onChange={(e) => setNewSetting((s) => ({ ...s, key: e.target.value }))}
                        required
                      />
                      <input
                        className="input-field text-sm"
                        placeholder="valeur"
                        value={newSetting.value}
                        onChange={(e) => setNewSetting((s) => ({ ...s, value: e.target.value }))}
                        required
                      />
                      <Button type="submit" className="w-auto text-sm">Ajouter</Button>
                    </div>
                  </form>
                </section>
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
                    placeholder="/"
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

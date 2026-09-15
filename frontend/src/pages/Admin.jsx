import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import Button from '../components/Button.jsx';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ASSISTANT_NAME } from '../constants/assistant.js';

const TABS = [
  { id: 'settings', label: 'Paramètres' },
  { id: 'tokens', label: `Tokens ${ASSISTANT_NAME}` },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'connections', label: 'Connexions' },
  { id: 'notifications', label: 'Notifications' },
];

/** Clé jour YYYY-MM-DD en fuseau Europe/Paris. */
function parisDayKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatUsageDayLabel(dayKey) {
  if (!dayKey) return '—';
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
      {
        key: 'memory_login_eval_enabled',
        label: 'Éval mémoire au login',
        hint: 'true / false — lance un scan IA si le contexte projet est stale',
      },
      {
        key: 'memory_login_eval_min_interval_hours',
        label: 'Intervalle mini éval login (h)',
        hint: 'Évite un scan à chaque reconnexion (ex. 12)',
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
    keys: ['idee_system', 'project_user', 'lieux', 'carte_implantation', 'ville_implantation', 'budget', 'formation'],
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
  {
    id: 'fabulous',
    title: 'Fabulous',
    keys: ['fabulous_page_guide', 'fabulous_task_checklist'],
  },
  {
    id: 'systeme',
    title: 'Système AiService',
    keys: [
      'ai_trusted_system',
      'ai_json_system',
      'ai_json_retry',
      'ai_france_system_extra',
      'ai_memory_context_prefix',
    ],
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
  const { logout, user: currentUser } = useAuth();
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
  const [userSearch, setUserSearch] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [connections, setConnections] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [expandedUsageDays, setExpandedUsageDays] = useState(() => new Set());
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

  const filteredUsers = useMemo(() => {
    const list = usersOverview?.users || [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        String(u.role || '').toLowerCase().includes(q) ||
        String(u.plan || '').toLowerCase().includes(q)
    );
  }, [usersOverview, userSearch]);

  const recentByDay = useMemo(() => {
    const map = new Map();
    for (const row of aiUsage?.recent || []) {
      const key = parisDayKey(row.createdAt);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }, [aiUsage?.recent]);

  const toggleUsageDay = (dayKey) => {
    setExpandedUsageDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

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

  const loadAiUsage = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await adminService.getAiUsage(30);
      setAiUsage(data);
    } catch (err) {
      setError(err.message || `Impossible de charger la consommation ${ASSISTANT_NAME}`);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'settings') loadSetup();
    else if (tab === 'tokens') loadAiUsage();
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
      setMessage(`Paramètres ${ASSISTANT_NAME} enregistrés`);
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
      setMessage(`Test ${ASSISTANT_NAME} réussi avec ${result.provider} / ${result.model}`);
    } catch (err) {
      setError(err.message || `Le test de ${ASSISTANT_NAME} a échoué`);
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

  const openUserDetails = async (user) => {
    setError('');
    setDetailsLoading(true);
    setUserDetails({ loading: true, user });
    try {
      const data = await adminService.getUserDetails(user.id);
      setUserDetails(data);
    } catch (err) {
      setUserDetails(null);
      setError(err.message || 'Impossible de charger les détails');
    } finally {
      setDetailsLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setError('');
    try {
      await adminService.deleteUser(userToDelete.id);
      setMessage(`Compte ${userToDelete.email} supprimé`);
      setUserToDelete(null);
      if (userDetails?.user?.id === userToDelete.id) setUserDetails(null);
      await loadOps({ silent: true });
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setDeletingUser(false);
    }
  };

  const formatAdminDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('fr-FR');
    } catch {
      return String(value);
    }
  };

  const sectionAnchors = [
    { id: 'ai', label: ASSISTANT_NAME },
    ...SETUP_SECTIONS.map((s) => ({ id: s.id, label: s.title })),
    { id: 'prompts', label: `Prompts ${ASSISTANT_NAME}` },
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
                      <h2 className="text-lg font-bold text-prune-900">{ASSISTANT_NAME}</h2>
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
                        {busyKey === 'test-ai' ? 'Test en cours…' : `Tester ${ASSISTANT_NAME}`}
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
                      {selectedProvider && (
                        <p className="text-xs text-prune-400 mt-1">
                          {selectedProvider.modelsSource === 'live'
                            ? `${availableModels.length} modèles (liste live Google)`
                            : `${availableModels.length} modèles (repli local)`}
                          {selectedProvider.modelsError
                            ? ` — ${selectedProvider.modelsError}`
                            : ''}
                        </p>
                      )}
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
                    {busyKey === 'ai' ? 'Enregistrement…' : `Enregistrer ${ASSISTANT_NAME}`}
                  </Button>

                  {aiTestResult && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      <p className="font-semibold">{ASSISTANT_NAME} opérationnel</p>
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
                    <h2 className="text-lg font-bold text-prune-900">Prompts {ASSISTANT_NAME}</h2>
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

            {tab === 'tokens' && aiUsage && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['Aujourd’hui', aiUsage.totals.tokensToday, `${aiUsage.totals.requestsToday} req.`],
                    ['Total (30 j)', aiUsage.totals.tokensTotal, `${aiUsage.totals.requests} req.`],
                    ['Prompt', aiUsage.totals.tokensPrompt, 'envoi'],
                    ['Complétion', aiUsage.totals.tokensCompletion, 'réception'],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-2xl bg-white/80 border border-prune-100 p-4">
                      <p className="text-xs uppercase tracking-wide text-prune-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-prune-900">
                        {Number(value || 0).toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-prune-400 mt-1">{hint}</p>
                    </div>
                  ))}
                </div>

                {aiUsage.totals.errors > 0 && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    {aiUsage.totals.errors} requête(s) en erreur sur la période.
                  </p>
                )}

                <section className="space-y-3">
                  <div>
                    <h2 className="text-lg font-bold text-prune-900">Consommation par jour</h2>
                    <p className="text-sm text-prune-500 mt-1">
                      Une tuile par jour (fermée par défaut) — tokens et dernières requêtes (fuseau
                      Europe/Paris).
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(aiUsage.byDay || []).map((day) => {
                      const dayKey = parisDayKey(day.day);
                      const open = expandedUsageDays.has(dayKey);
                      const dayRows = recentByDay.get(dayKey) || [];
                      return (
                        <div
                          key={dayKey || String(day.day)}
                          className="rounded-2xl bg-white/80 border border-prune-100 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleUsageDay(dayKey)}
                            aria-expanded={open}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-prune-50/80 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-prune-900 capitalize">
                                {formatUsageDayLabel(dayKey)}
                              </p>
                              <p className="text-xs text-prune-500 mt-0.5">
                                {day.requests} req. ·{' '}
                                {Number(day.tokensTotal || 0).toLocaleString('fr-FR')} tokens
                                {day.errors > 0 ? ` · ${day.errors} erreur(s)` : ''}
                              </p>
                            </div>
                            <svg
                              className={`w-5 h-5 text-prune-400 shrink-0 transition-transform ${
                                open ? 'rotate-180' : ''
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path strokeLinecap="round" d="M6 9l6 6 6-6" />
                            </svg>
                          </button>

                          {open && (
                            <div className="border-t border-prune-100 px-4 py-4 space-y-4">
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  ['Envoi', day.tokensPrompt],
                                  ['Réception', day.tokensCompletion],
                                  ['Total', day.tokensTotal],
                                ].map(([sub, val]) => (
                                  <div
                                    key={sub}
                                    className="rounded-xl bg-prune-50 px-2 py-2 text-center"
                                  >
                                    <p className="text-[10px] uppercase tracking-wide text-prune-500">
                                      {sub}
                                    </p>
                                    <p className="text-sm font-bold text-prune-900 mt-0.5">
                                      {Number(val || 0).toLocaleString('fr-FR')}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div>
                                <h3 className="text-sm font-semibold text-prune-800 mb-2">
                                  Dernières requêtes
                                </h3>
                                {dayRows.length ? (
                                  <div className="overflow-x-auto rounded-xl border border-prune-100">
                                    <table className="w-full text-sm">
                                      <thead className="bg-prune-50 text-left">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold text-prune-700">
                                            Heure
                                          </th>
                                          <th className="px-3 py-2 font-semibold text-prune-700">
                                            User
                                          </th>
                                          <th className="px-3 py-2 font-semibold text-prune-700">
                                            Usage
                                          </th>
                                          <th className="px-3 py-2 font-semibold text-prune-700">
                                            Modèle
                                          </th>
                                          <th className="px-3 py-2 font-semibold text-prune-700">
                                            Tokens
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dayRows.map((row) => (
                                          <tr key={row.id} className="border-t border-prune-100">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              {row.createdAt
                                                ? new Date(row.createdAt).toLocaleTimeString(
                                                    'fr-FR',
                                                    { hour: '2-digit', minute: '2-digit' }
                                                  )
                                                : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                              {row.userEmail ||
                                                row.userName ||
                                                (row.userId ? `#${row.userId}` : '—')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="px-2 py-0.5 rounded-lg bg-prune-100 text-prune-700 text-xs font-medium">
                                                {row.purpose || '—'}
                                              </span>
                                              {row.status === 'error' && (
                                                <span className="ml-2 text-xs text-red-600">
                                                  erreur
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-prune-500">
                                              {[row.provider, row.model].filter(Boolean).join(' / ') ||
                                                '—'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              {row.tokensPrompt ?? '—'} →{' '}
                                              {row.tokensCompletion ?? '—'}
                                              <span className="text-prune-400">
                                                {' '}
                                                ({row.tokensTotal ?? '—'})
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-prune-500">
                                    Aucune requête récente listée pour ce jour (hors des 40
                                    dernières).
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!aiUsage.byDay?.length && (
                      <p className="text-sm text-prune-500">
                        Aucune consommation enregistrée pour le moment.
                      </p>
                    )}
                  </div>
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

                <div className="card p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-prune-500 mb-2">
                    Rechercher un utilisateur
                  </label>
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Nom, email, id, rôle, plan…"
                    className="input-field w-full"
                  />
                  <p className="mt-2 text-xs text-prune-500">
                    {filteredUsers.length} résultat{filteredUsers.length > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-prune-50 text-left">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-prune-700">Nom</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Email</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Plan</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Rôle</th>
                          <th className="px-4 py-3 font-semibold text-prune-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => {
                          const isSelf = Number(currentUser?.id) === Number(user.id);
                          return (
                            <tr key={user.id} className="border-t border-prune-100">
                              <td className="px-4 py-3">{user.name}</td>
                              <td className="px-4 py-3">{user.email}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-prune-100 text-prune-700">
                                  {user.plan === 'paid' ? 'Payant' : 'Gratuit'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold
                                ${
                                  user.role === 'admin'
                                    ? 'bg-wasabi-100 text-wasabi-800'
                                    : 'bg-prune-100 text-prune-700'
                                }`}
                                >
                                  {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openUserDetails(user)}
                                    className="text-xs font-semibold text-topaz-600 hover:underline"
                                  >
                                    Détails
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleRole(user)}
                                    className="text-xs font-semibold text-prune-600 hover:underline"
                                  >
                                    {user.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    title={isSelf ? 'Impossible de supprimer votre propre compte' : undefined}
                                    onClick={() => setUserToDelete(user)}
                                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-prune-500">
                              Aucun utilisateur ne correspond à la recherche.
                            </td>
                          </tr>
                        )}
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

      {userDetails && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-user-details-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-prune-900/50"
            aria-label="Fermer"
            onClick={() => setUserDetails(null)}
          />
          <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
                  Compte utilisateur
                </p>
                <h2 id="admin-user-details-title" className="text-lg font-bold text-prune-900 mt-1">
                  {userDetails.user?.email || 'Chargement…'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setUserDetails(null)}
                className="p-2 rounded-lg text-prune-500 hover:bg-prune-50"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {(detailsLoading || userDetails.loading) && (
              <p className="text-sm text-prune-500">Chargement des détails…</p>
            )}

            {!detailsLoading && !userDetails.loading && userDetails.user && (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-prune-800">Informations compte</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {[
                      ['ID', userDetails.user.id],
                      ['Nom', userDetails.user.name],
                      ['Email', userDetails.user.email],
                      ['Rôle', userDetails.user.role],
                      ['Plan', userDetails.user.plan],
                      ['Créé le', formatAdminDate(userDetails.user.createdAt)],
                      ['Mis à jour', formatAdminDate(userDetails.user.updatedAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-prune-50 px-3 py-2">
                        <dt className="text-xs text-prune-500">{label}</dt>
                        <dd className="font-medium text-prune-900 break-all">{value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-prune-800">Compteurs liés</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {Object.entries(userDetails.stats || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-prune-100 px-3 py-2">
                        <p className="text-xs text-prune-500">{key}</p>
                        <p className="font-semibold text-prune-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-bold text-prune-800">
                    Projets ({userDetails.projects?.length || 0})
                  </h3>
                  {(userDetails.projects || []).length === 0 && (
                    <p className="text-sm text-prune-500">Aucun projet rattaché.</p>
                  )}
                  {(userDetails.projects || []).map((project) => (
                    <article
                      key={project.id}
                      className="rounded-2xl border border-prune-100 p-4 space-y-3"
                    >
                      <div>
                        <p className="font-semibold text-prune-900">
                          #{project.id} — {project.title || 'Sans titre'}
                        </p>
                        <p className="text-xs text-prune-500 mt-1">
                          {project.status} · {project.stage} · {project.source} ·{' '}
                          {formatAdminDate(project.createdAt)}
                        </p>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {[
                          ['Quoi', project.quoi],
                          ['Où', project.ou],
                          ['Budget', project.budget != null ? `${project.budget} ${project.currency || ''}` : null],
                          ['Forme juridique', project.legalForm],
                          ['Activité', project.activity?.label],
                          ['Lieu', project.location?.label],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-prune-500">{label}</dt>
                            <dd className="text-prune-800">{value || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                      {project.description && (
                        <div>
                          <p className="text-xs text-prune-500">Description</p>
                          <p className="text-sm text-prune-800 whitespace-pre-wrap">{project.description}</p>
                        </div>
                      )}
                      {project.report && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-prune-600 font-medium">Rapport</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs bg-prune-50 rounded-xl p-3 max-h-48 overflow-auto">
                            {project.report}
                          </pre>
                        </details>
                      )}
                      {Array.isArray(project.sections) && project.sections.length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-prune-600 font-medium">
                            Sections ({project.sections.length})
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs bg-prune-50 rounded-xl p-3 max-h-48 overflow-auto">
                            {JSON.stringify(project.sections, null, 2)}
                          </pre>
                        </details>
                      )}
                      {project.aiPrompt && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-prune-600 font-medium">Prompt IA</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs bg-prune-50 rounded-xl p-3 max-h-40 overflow-auto">
                            {project.aiPrompt}
                          </pre>
                        </details>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {Object.entries(project.counts || {}).map(([key, value]) => (
                          <div key={key} className="rounded-lg bg-prune-50 px-2 py-1.5">
                            <span className="text-prune-500">{key}</span>
                            <span className="ml-1 font-semibold text-prune-900">{value}</span>
                          </div>
                        ))}
                      </div>
                      {project.memorySnapshot && (
                        <details className="text-sm" open>
                          <summary className="cursor-pointer text-prune-600 font-medium">
                            Mémoire persistante
                          </summary>
                          <div className="mt-2 space-y-2 text-xs bg-prune-50 rounded-xl p-3">
                            <p><span className="text-prune-500">Généré :</span> {formatAdminDate(project.memorySnapshot.generatedAt)}</p>
                            <p><span className="text-prune-500">Modèle :</span> {project.memorySnapshot.modelUsed || '—'}</p>
                            <p className="whitespace-pre-wrap"><span className="text-prune-500">Résumé :</span> {project.memorySnapshot.summary || '—'}</p>
                            <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                              {JSON.stringify(
                                {
                                  keyFacts: project.memorySnapshot.keyFacts,
                                  activeBlockers: project.memorySnapshot.activeBlockers,
                                  nextActions: project.memorySnapshot.nextActions,
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </details>
                      )}
                      {(project.documents || []).length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-prune-600 font-medium">
                            Documents ({project.documents.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {project.documents.map((doc) => (
                              <li key={doc.id} className="rounded-lg border border-prune-100 px-2 py-1.5">
                                #{doc.id} · {doc.title || doc.fileName} · {doc.type} · {doc.mimeType || '—'}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </article>
                  ))}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-user-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-prune-900/50"
            aria-label="Fermer"
            disabled={deletingUser}
            onClick={() => {
              if (!deletingUser) setUserToDelete(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-xl p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">
                Suppression
              </p>
              <h2 id="admin-delete-user-title" className="text-lg font-bold text-prune-900 mt-1">
                Supprimer le compte {userToDelete.email} ?
              </h2>
              <p className="text-sm text-prune-500 mt-2">
                Cette action est définitive : projets, documents, mémoire, contacts et données liées
                seront aussi supprimés.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={deletingUser}
                onClick={() => setUserToDelete(null)}
              >
                Annuler
              </Button>
              <Button type="button" onClick={confirmDeleteUser} disabled={deletingUser}>
                {deletingUser ? 'Suppression…' : 'Supprimer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

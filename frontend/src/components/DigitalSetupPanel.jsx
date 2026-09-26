import { useState } from 'react';

const SCOPE_OPTIONS = [
  { value: 'country', label: 'France' },
  { value: 'eu', label: 'Union européenne' },
  { value: 'world', label: 'Monde' },
  { value: 'region', label: 'Région / zone' },
  { value: 'city', label: 'Ville / bassin' },
];

const HOSTING_OPTIONS = [
  { value: 'cloud_managed', label: 'Cloud managé (AWS, GCP, Azure…)' },
  { value: 'vps', label: 'VPS / serveur dédié' },
  { value: 'saas_nocode', label: 'SaaS / no-code (hébergé)' },
  { value: 'other', label: 'Autre / à définir' },
];

const WORK_OPTIONS = [
  { value: 'remote', label: '100 % télétravail' },
  { value: 'coworking', label: 'Coworking' },
  { value: 'office', label: 'Bureau / local équipe' },
];

const CHANNEL_OPTIONS = [
  { value: 'web', label: 'Site / web app' },
  { value: 'mobile', label: 'Application mobile' },
  { value: 'marketplace', label: 'Marketplace' },
];

/**
 * Panel setup complet pour business dématérialisé.
 */
export default function DigitalSetupPanel({
  businessTitle,
  initial = null,
  onSubmit,
  disabled = false,
}) {
  const [marketScope, setMarketScope] = useState(initial?.marketScope || 'country');
  const [hosting, setHosting] = useState(initial?.hosting || 'cloud_managed');
  const [workMode, setWorkMode] = useState(initial?.workMode || 'remote');
  const [legalAddress, setLegalAddress] = useState(initial?.legalAddress || '');
  const [channels, setChannels] = useState(
    Array.isArray(initial?.channels) && initial.channels.length
      ? initial.channels
      : ['web']
  );
  const [opsNotes, setOpsNotes] = useState(initial?.opsNotes || '');
  const [error, setError] = useState('');

  const toggleChannel = (value) => {
    setChannels((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!legalAddress.trim()) {
      setError('Indiquez une adresse légale / siège social (même pour un business digital).');
      return;
    }
    if (!channels.length) {
      setError('Sélectionnez au moins un canal (web, app, marketplace…).');
      return;
    }
    setError('');
    onSubmit({
      marketScope,
      hosting,
      workMode,
      legalAddress: legalAddress.trim(),
      channels,
      opsNotes: opsNotes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-prune-200 bg-white p-5 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-prune-500">Dématérialisé</p>
        <h2 className="text-lg font-bold text-prune-900 mt-1">
          Setup opérationnel pour « {businessTitle} »
        </h2>
        <p className="text-sm text-prune-500 mt-1">
          Marché, hébergement, lieu de travail, adresse légale et canaux — sans point de vente physique.
        </p>
      </div>

      {error && <p className="alert-error text-sm">{error}</p>}

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Portée du marché</legend>
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setMarketScope(opt.value)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                marketScope === opt.value
                  ? 'border-prune-500 bg-prune-100 text-prune-900'
                  : 'border-prune-100 text-prune-600 hover:border-prune-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Hébergement / infra</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {HOSTING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setHosting(opt.value)}
              className={[
                'rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                hosting === opt.value
                  ? 'border-prune-500 bg-prune-100 text-prune-900'
                  : 'border-prune-100 text-prune-600 hover:border-prune-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Lieu de travail</legend>
        <div className="flex flex-wrap gap-2">
          {WORK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setWorkMode(opt.value)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                workMode === opt.value
                  ? 'border-prune-500 bg-prune-100 text-prune-900'
                  : 'border-prune-100 text-prune-600 hover:border-prune-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="digital-legal" className="block text-sm font-medium text-prune-800 mb-1">
          Adresse légale / siège social
        </label>
        <input
          id="digital-legal"
          type="text"
          className="input-field w-full"
          placeholder="Ex : domicile, domiciliation, le cas échéant un bureau…"
          value={legalAddress}
          onChange={(e) => setLegalAddress(e.target.value)}
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-prune-400">
          Distinct du « lieu business » : pas de magasin, mais une adresse déclarée.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-prune-800 mb-2">Canaux</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((opt) => {
            const on = channels.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggleChannel(opt.value)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  on
                    ? 'border-prune-500 bg-prune-100 text-prune-900'
                    : 'border-prune-100 text-prune-600 hover:border-prune-300',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="digital-ops" className="block text-sm font-medium text-prune-800 mb-1">
          Ops (paiement, support, stock…) — optionnel
        </label>
        <textarea
          id="digital-ops"
          className="input-field w-full min-h-[80px]"
          placeholder="Ex : Stripe, support Discord, stock chez un 3PL…"
          value={opsNotes}
          onChange={(e) => setOpsNotes(e.target.value)}
          disabled={disabled}
        />
      </div>

      <button type="submit" disabled={disabled} className="btn-primary w-full sm:w-auto disabled:opacity-50">
        Continuer vers le budget
      </button>
    </form>
  );
}

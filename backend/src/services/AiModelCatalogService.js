import { config } from '../config/index.js';
import { AI_PROVIDERS, getProviderById } from '../config/aiProviders.js';

const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {{ at: number, catalog: object[] } | null} */
let cache = null;

function humanizeModelId(id) {
  return String(id)
    .replace(/^models\//, '')
    .replace(/[:/]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function toModelEntry(id, label) {
  const modelId = String(id || '').trim();
  if (!modelId) return null;
  return { id: modelId, label: label || humanizeModelId(modelId) };
}

function dedupeModels(models) {
  const seen = new Set();
  const out = [];
  for (const m of models) {
    if (!m?.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

async function fetchJson(url, { headers = {}, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function staticModels(providerId) {
  return getProviderById(providerId)?.models?.slice() || [];
}

function isOpenAiChatModel(id) {
  const lower = id.toLowerCase();
  if (
    /embedding|whisper|tts|dall-e|davinci|babbage|ada|moderation|transcribe|realtime|image|sora|codex-mini/.test(
      lower
    )
  ) {
    return false;
  }
  return /^(gpt-|o[1-9]|chatgpt-|ft:)/.test(lower) || lower.includes('gpt');
}

function isGroqChatModel(id) {
  const lower = id.toLowerCase();
  return !/whisper|tts|guard|distil|playai|canary|prompt-guard|orpheus|speech|audio/.test(lower);
}

function isMistralChatModel(model) {
  const id = String(model?.id || '').toLowerCase();
  if (!id) return false;
  if (/embed|moderation/.test(id)) return false;
  if (model?.capabilities?.completion_chat === false) return false;
  return true;
}

async function fetchGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`;
  const json = await fetchJson(url);
  const models = (json.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods)
      && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => {
      const id = String(m.name || '').replace(/^models\//, '');
      return toModelEntry(id, m.displayName || id);
    })
    .filter(Boolean);
  return dedupeModels(models);
}

async function fetchOpenAiCompatModels(baseUrl, apiKey, { filter, extraHeaders = {} } = {}) {
  const json = await fetchJson(`${baseUrl.replace(/\/$/, '')}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
  });
  const models = (json.data || [])
    .map((m) => m.id)
    .filter((id) => (filter ? filter(id) : Boolean(id)))
    .map((id) => toModelEntry(id))
    .filter(Boolean);
  return dedupeModels(models);
}

async function fetchMistralModels(apiKey) {
  const json = await fetchJson('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const models = (json.data || [])
    .filter(isMistralChatModel)
    .map((m) => toModelEntry(m.id, m.name || m.id))
    .filter(Boolean);
  return dedupeModels(models);
}

async function fetchOpenRouterModels(apiKey) {
  const json = await fetchJson('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': config.appUrl || 'http://localhost:5173',
      'X-Title': 'Kizumai Setup',
    },
  });

  const free = [];
  const paid = [];
  for (const m of json.data || []) {
    const id = m.id;
    if (!id) continue;
    const modality = String(m.architecture?.modality || m.architecture?.input_modalities?.join(',') || 'text');
    if (modality && !/text/i.test(modality) && !/file/i.test(modality)) continue;

    const promptPrice = Number(m.pricing?.prompt ?? NaN);
    const isFree = id.endsWith(':free') || promptPrice === 0;
    const entry = toModelEntry(id, m.name || id);
    if (!entry) continue;
    if (isFree) free.push(entry);
    else paid.push(entry);
  }

  // Priorité aux gratuits (comme le catalogue actuel) + un échantillon payant limité
  const preferredStatic = new Set(staticModels('openrouter').map((m) => m.id));
  const paidKeep = paid.filter((m) => preferredStatic.has(m.id)).slice(0, 20);
  return dedupeModels([...free, ...paidKeep]);
}

const FETCHERS = {
  gemini: (key) => fetchGeminiModels(key),
  openai: (key) => fetchOpenAiCompatModels('https://api.openai.com/v1', key, {
    filter: isOpenAiChatModel,
  }),
  groq: (key) => fetchOpenAiCompatModels('https://api.groq.com/openai/v1', key, {
    filter: isGroqChatModel,
  }),
  mistral: (key) => fetchMistralModels(key),
  openrouter: (key) => fetchOpenRouterModels(key),
};

function ensureSelectedModel(models, selectedModelId, fallbackModels) {
  const list = models?.length ? models : fallbackModels;
  if (!selectedModelId) return list;
  if (list.some((m) => m.id === selectedModelId)) return list;
  return dedupeModels([
    ...list,
    toModelEntry(selectedModelId),
  ]);
}

async function fetchProviderCatalogEntry(provider, aiConfig, selectedByProvider = {}) {
  const apiKey = aiConfig[provider.envKey];
  const configured = Boolean(apiKey);
  const fallback = staticModels(provider.id);
  const base = {
    id: provider.id,
    name: provider.name,
    defaultModel: provider.defaultModel,
    configured,
    models: fallback,
    modelsSource: 'fallback',
    modelsError: null,
  };

  if (!configured) {
    base.modelsError = 'Clé API absente';
    base.models = ensureSelectedModel(fallback, selectedByProvider[provider.id], fallback);
    return base;
  }

  const fetchFn = FETCHERS[provider.id];
  if (!fetchFn) {
    base.models = ensureSelectedModel(fallback, selectedByProvider[provider.id], fallback);
    return base;
  }

  try {
    const live = await fetchFn(apiKey);
    const models = ensureSelectedModel(
      live.length ? live : fallback,
      selectedByProvider[provider.id],
      fallback
    );
    return {
      ...base,
      models,
      modelsSource: live.length ? 'live' : 'fallback',
      modelsError: live.length ? null : 'Liste vide côté fournisseur — catalogue local utilisé',
    };
  } catch (err) {
    return {
      ...base,
      models: ensureSelectedModel(fallback, selectedByProvider[provider.id], fallback),
      modelsSource: 'fallback',
      modelsError: err.message || 'Échec du rafraîchissement',
    };
  }
}

/**
 * Catalogue fournisseurs avec modèles rafraîchis depuis les API officielles.
 * @param {{ force?: boolean, selectedProvider?: string, selectedModel?: string }} [opts]
 */
export async function getLiveProviderCatalog(opts = {}) {
  const { force = false, selectedProvider, selectedModel } = opts;
  const now = Date.now();

  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return {
      providers: cache.catalog,
      refreshedAt: new Date(cache.at).toISOString(),
      fromCache: true,
    };
  }

  const selectedByProvider = {};
  if (selectedProvider && selectedModel) {
    selectedByProvider[selectedProvider] = selectedModel;
  }

  const catalog = await Promise.all(
    AI_PROVIDERS.map((provider) =>
      fetchProviderCatalogEntry(provider, config.ai, selectedByProvider)
    )
  );

  cache = { at: now, catalog };

  return {
    providers: catalog,
    refreshedAt: new Date(now).toISOString(),
    fromCache: false,
  };
}

export function isModelInCatalog(providers, providerId, modelId) {
  const provider = providers?.find((p) => p.id === providerId);
  if (!provider) return false;
  return provider.models.some((m) => m.id === modelId);
}

export function clearModelCatalogCache() {
  cache = null;
}

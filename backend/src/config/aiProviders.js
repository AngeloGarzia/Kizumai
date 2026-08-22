export const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'geminiApiKey',
    defaultModel: 'gemini-3.6-flash',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'openaiApiKey',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    envKey: 'groqApiKey',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    envKey: 'mistralApiKey',
    defaultModel: 'mistral-small-latest',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'open-mistral-nemo', label: 'Mistral Nemo' },
      { id: 'mistral-large-latest', label: 'Mistral Large' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    envKey: 'openrouterApiKey',
    defaultModel: 'openai/gpt-oss-20b:free',
    models: [
      { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (free)' },
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (free)' },
      { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B (free)' },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (free)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'Llama 3.2 3B (free)' },
    ],
  },
];

export function getProviderById(id) {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export function getProviderCatalog(aiConfig) {
  return AI_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    defaultModel: provider.defaultModel,
    models: provider.models,
    configured: Boolean(aiConfig[provider.envKey]),
  }));
}

export function isModelValidForProvider(providerId, modelId) {
  const provider = getProviderById(providerId);
  if (!provider) return false;
  return provider.models.some((m) => m.id === modelId);
}

export function resolveModel(providerId, modelId) {
  const provider = getProviderById(providerId);
  if (!provider) return null;
  const trimmed = modelId != null ? String(modelId).trim() : '';
  // Accepte le modèle enregistré en base (catalogue live ou legacy).
  if (trimmed) return trimmed;
  return provider.defaultModel;
}

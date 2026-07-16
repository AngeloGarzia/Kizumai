import { config } from '../config/index.js';
import { getProviderById } from '../config/aiProviders.js';
import { AppError } from '../utils/AppError.js';
import { CurrencyService } from './CurrencyService.js';
import { SettingsService } from './SettingsService.js';

const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 60_000;

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Délai dépassé après ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function formatBudgetLabel(amount, currency) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildProjectContext({ quoi, ou, budget, currency }, limits) {
  const lines = [];
  if (quoi) lines.push(`Quoi : ${quoi}`);
  if (ou) lines.push(`Où : ${ou}`);
  if (budget != null) lines.push(`Budget : ${budget} ${currency || 'EUR'}`);

  const missing = [];
  if (!quoi) missing.push('quoi');
  if (!ou) missing.push('ou');
  if (budget == null) missing.push('budget');

  if (missing.length) {
    lines.push(`Champs à compléter : ${missing.join(', ')}`);
  }

  lines.push(`Fourchette budget autorisée : ${limits.min} à ${limits.max} ${currency || 'EUR'}`);

  return lines.join('\n');
}

function interpolatePrompt(template, fields, limits) {
  if (!template) return '';

  const missing = [];
  if (!fields.quoi) missing.push('quoi');
  if (!fields.ou) missing.push('ou');
  if (fields.budget == null) missing.push('budget');

  return template
    .replace(/\{\{quoi\}\}/g, fields.quoi || '')
    .replace(/\{\{ou\}\}/g, fields.ou || '')
    .replace(/\{\{budget\}\}/g, fields.budget != null ? String(fields.budget) : '')
    .replace(/\{\{currency\}\}/g, fields.currency || 'EUR')
    .replace(/\{\{budget_min\}\}/g, String(limits.min))
    .replace(/\{\{budget_max\}\}/g, String(limits.max))
    .replace(/\{\{missing_fields\}\}/g, missing.join(', ') || 'aucun');
}

// Interpolation générique {{clé}} → valeur, utilisée par le parcours de
// recherche en 3 phases. Le contenu métier vient intégralement des prompts
// en base ; le code ne fait que substituer les variables.
function interpolate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] != null && vars[key] !== '' ? String(vars[key]) : ''
  );
}

// Les modèles renvoient parfois le JSON entouré de ``` ou de texte.
// On isole et parse le premier objet JSON exploitable.
function extractJson(text) {
  if (!text) throw new AppError('Réponse IA vide', 502);

  let cleaned = String(text).trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // On tente d'extraire le premier bloc {...}.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
  }

  throw new AppError('Réponse IA non exploitable (JSON attendu)', 502);
}

function sectionsToReport(sections) {
  return sections
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join('\n\n');
}

function normalizeSections(rawSections) {
  if (!Array.isArray(rawSections)) return [];

  return rawSections
    .map((section) => ({
      title: String(section?.title || '').trim(),
      content: String(section?.content || '').trim(),
    }))
    .filter((section) => section.title && section.content);
}

function buildMinimalReport({ quoi, ou, budget, currency }) {
  const budgetLabel = formatBudgetLabel(budget, currency);
  return `Projet : ${quoi}. Lieu : ${ou}. Budget estimé : ${budgetLabel}.`;
}

async function buildAiPrompts(fields, limits) {
  const aiConfig = await SettingsService.getAiConfig();
  const needsOu = !fields.ou;
  const needsBudget = fields.budget == null;

  const systemParts = [];
  if (aiConfig.ideeSystemPrompt) systemParts.push(aiConfig.ideeSystemPrompt);
  if (needsOu && aiConfig.lieuxPrompt) systemParts.push(aiConfig.lieuxPrompt);
  if (needsBudget && aiConfig.budgetPrompt) systemParts.push(aiConfig.budgetPrompt);

  const systemContent = systemParts.join('\n\n');
  const userPrompt = interpolatePrompt(aiConfig.userPromptTemplate, fields, limits);
  const projectContext = buildProjectContext(fields, limits);
  const userContent = userPrompt
    ? `${userPrompt}\n\n---\nContexte projet :\n${projectContext}`
    : projectContext;

  return { systemContent, userContent, temperature: aiConfig.temperature, aiConfig };
}

function parseCompletionJson(content, currency) {
  const parsed = JSON.parse(content);
  const result = {
    quoi: String(parsed.quoi || '').trim(),
    ou: String(parsed.ou || '').trim(),
    budget: CurrencyService.clampBudget(parsed.budget, currency),
    report: String(parsed.report || '').trim(),
    sections: normalizeSections(parsed.sections),
  };

  if (!result.report && result.sections.length) {
    result.report = sectionsToReport(result.sections);
  }

  return result;
}

function providerApiKey(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) return '';
  return config.ai[provider.envKey] || '';
}

const OPENAI_COMPAT_BASES = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

function openAiCompatHeaders(apiKey, providerId) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  // En-têtes recommandés par OpenRouter (classement / attribution).
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = config.appUrl;
    headers['X-Title'] = 'Kizumai';
  }
  return headers;
}

// Appel bas niveau générique : envoie system + user et renvoie le texte brut.
// Sert au parcours de recherche (sortie JSON libre selon le prompt en base).
async function rawChatText({ systemContent, userContent, aiConfig, providerId, apiKey }) {
  if (providerId === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: aiConfig.temperature,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };
    if (systemContent) {
      body.systemInstruction = { parts: [{ text: systemContent }] };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Gemini ${response.status}`);

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new AppError('Réponse IA invalide', 502);
    return content;
  }

  const baseUrl = OPENAI_COMPAT_BASES[providerId];
  if (!baseUrl) throw new AppError('Fournisseur IA non supporté', 400);

  const messages = [];
  if (systemContent) messages.push({ role: 'system', content: systemContent });
  messages.push({ role: 'user', content: userContent });

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: openAiCompatHeaders(apiKey, providerId),
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`${providerId} ${response.status}${errBody ? `: ${errBody.slice(0, 240)}` : ''}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AppError('Réponse IA invalide', 502);
  return content;
}

// Envoie un prompt (déjà interpolé) et renvoie le JSON parsé.
async function requestStepJson(userContent) {
  const aiConfig = await SettingsService.getAiConfig();
  const providerId = aiConfig.provider;
  const apiKey = providerApiKey(providerId);
  if (!apiKey) {
    throw new AppError(
      `Clé API manquante pour ${providerId}. Configurez-la dans les réglages pour lancer la recherche.`,
      503
    );
  }

  try {
    const text = await rawChatText({
      systemContent: '',
      userContent,
      aiConfig,
      providerId,
      apiKey,
    });
    return extractJson(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.warn(`[ai] Échec recherche ${providerId} (${aiConfig.model}): ${error.message}`);
    throw new AppError("La recherche IA a échoué. Réessayez dans un instant.", 502);
  }
}

function joinAvoid(avoid) {
  if (!Array.isArray(avoid) || !avoid.length) return 'aucune';
  return avoid.filter(Boolean).join(' ; ');
}

function normalizeFeasibility(value) {
  const num = Math.round(Number(value));
  if (Number.isNaN(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function normalizeBusinesses(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      title: String(item?.title || '').trim(),
      activity: String(item?.activity || '').trim(),
      pitch: String(item?.pitch || '').trim(),
      rationale: String(item?.rationale || '').trim(),
      feasibility: normalizeFeasibility(item?.feasibility),
    }))
    .filter((item) => item.title);
}

function normalizeLocations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      label: String(item?.label || '').trim(),
      city: String(item?.city || '').trim(),
      area: String(item?.area || '').trim(),
      rationale: String(item?.rationale || '').trim(),
      feasibility: normalizeFeasibility(item?.feasibility),
    }))
    .filter((item) => item.label || item.city);
}

const PROPOSAL_KINDS = new Set([
  'budget_utilisateur',
  'budget_flexible',
  'budget_ideal',
  'budget_ajuste',
]);
const PROPOSAL_KIND_ORDER = {
  budget_utilisateur: 0,
  budget_flexible: 1,
  budget_ideal: 2,
  budget_ajuste: 3,
};

function normalizeProposals(raw, currency, userBudget = null) {
  if (!Array.isArray(raw)) return [];
  const userAmount =
    userBudget != null && userBudget !== '' ? Number(userBudget) : null;

  return raw
    .map((item) => {
      const sections = normalizeSections(item?.sections);
      let report = String(item?.report || '').trim();
      if (!report && sections.length) report = sectionsToReport(sections);
      const kind = PROPOSAL_KINDS.has(item?.kind) ? item.kind : 'budget_utilisateur';
      return {
        kind,
        title: String(item?.title || '').trim(),
        budget: CurrencyService.clampBudget(item?.budget, currency),
        currency: currency || 'EUR',
        feasibility: normalizeFeasibility(item?.feasibility),
        report,
        sections,
      };
    })
    .filter((item) => {
      if (!item.title || item.budget == null) return false;
      // « Ajusté » uniquement si strictement inférieur au budget de départ.
      if (item.kind === 'budget_ajuste') {
        if (userAmount == null || Number.isNaN(userAmount)) return false;
        return item.budget < userAmount;
      }
      return true;
    })
    .sort(
      (a, b) => (PROPOSAL_KIND_ORDER[a.kind] ?? 9) - (PROPOSAL_KIND_ORDER[b.kind] ?? 9)
    );
}

function normalizeBudgetAssessment(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      userBudgetTooHigh: false,
      message: '',
      feasibility: null,
      adjustedProposed: false,
    };
  }
  const userBudgetTooHigh = Boolean(raw.user_budget_too_high ?? raw.userBudgetTooHigh);
  const message = String(raw.message || '').trim();
  return {
    userBudgetTooHigh,
    message: userBudgetTooHigh ? message : '',
    feasibility: normalizeFeasibility(raw.feasibility),
    adjustedProposed: Boolean(raw.adjusted_proposed ?? raw.adjustedProposed),
  };
}

async function completeWithGemini(fields, limits, aiConfig) {
  const apiKey = providerApiKey('gemini');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { systemContent, userContent, temperature } = await buildAiPrompts(fields, limits);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemContent }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new AppError('Réponse IA invalide', 502);

  return parseCompletionJson(content, fields.currency);
}

async function completeWithOpenAICompat({
  fields,
  limits,
  aiConfig,
  apiKey,
  baseUrl,
  providerLabel,
  providerId,
}) {
  const { systemContent, userContent, temperature } = await buildAiPrompts(fields, limits);

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: openAiCompatHeaders(apiKey, providerId),
    body: JSON.stringify({
      model: aiConfig.model,
      temperature,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`${providerLabel} ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AppError('Réponse IA invalide', 502);

  return parseCompletionJson(content, fields.currency);
}

async function completeWithProvider(providerId, fields, limits, aiConfig) {
  const apiKey = providerApiKey(providerId);
  if (!apiKey) {
    throw new AppError(`Clé API manquante pour ${providerId}`, 503);
  }

  switch (providerId) {
    case 'gemini':
      return completeWithGemini(fields, limits, aiConfig);
    case 'openai':
      return completeWithOpenAICompat({
        fields,
        limits,
        aiConfig,
        apiKey,
        baseUrl: OPENAI_COMPAT_BASES.openai,
        providerLabel: 'OpenAI',
        providerId: 'openai',
      });
    case 'groq':
      return completeWithOpenAICompat({
        fields,
        limits,
        aiConfig,
        apiKey,
        baseUrl: OPENAI_COMPAT_BASES.groq,
        providerLabel: 'Groq',
        providerId: 'groq',
      });
    case 'mistral':
      return completeWithOpenAICompat({
        fields,
        limits,
        aiConfig,
        apiKey,
        baseUrl: OPENAI_COMPAT_BASES.mistral,
        providerLabel: 'Mistral',
        providerId: 'mistral',
      });
    case 'openrouter':
      return completeWithOpenAICompat({
        fields,
        limits,
        aiConfig,
        apiKey,
        baseUrl: OPENAI_COMPAT_BASES.openrouter,
        providerLabel: 'OpenRouter',
        providerId: 'openrouter',
      });
    default:
      throw new AppError('Fournisseur IA non supporté', 400);
  }
}

function completeWithHeuristic({ quoi, ou, budget, currency }) {
  const context = [quoi, ou].filter(Boolean).join(' ').toLowerCase();
  const limits = CurrencyService.getBudgetLimits(currency);

  let resolvedQuoi = quoi?.trim() || '';
  let resolvedOu = ou?.trim() || '';
  let resolvedBudget = budget != null ? CurrencyService.clampBudget(budget, currency) : null;

  if (!resolvedQuoi) {
    if (context.includes('restaurant') || context.includes('food')) {
      resolvedQuoi = 'Concept de restauration ou food service';
    } else if (context.includes('app') || context.includes('digital')) {
      resolvedQuoi = 'Projet digital / application';
    } else if (context.includes('boutique') || context.includes('commerce')) {
      resolvedQuoi = 'Commerce de proximité ou e-commerce';
    } else {
      resolvedQuoi = 'Projet entrepreneurial adapté à votre profil';
    }
  }

  if (!resolvedOu) {
    if (context.includes('paris')) resolvedOu = 'Paris, France';
    else if (context.includes('lyon')) resolvedOu = 'Lyon, France';
    else if (context.includes('marseille')) resolvedOu = 'Marseille, France';
    else if (context.includes('online') || context.includes('digital')) resolvedOu = 'En ligne / marché digital';
    else resolvedOu = 'France — zone à affiner selon votre marché';
  }

  if (resolvedBudget == null) {
    const text = `${resolvedQuoi} ${context}`.toLowerCase();
    if (text.includes('restaurant') || text.includes('boutique physique')) {
      resolvedBudget = CurrencyService.clampBudget(limits.min * 160, currency);
    } else if (text.includes('digital') || text.includes('app')) {
      resolvedBudget = CurrencyService.clampBudget(limits.min * 30, currency);
    } else {
      resolvedBudget = CurrencyService.clampBudget(limits.min * 50, currency);
    }
  }

  const resolved = {
    quoi: resolvedQuoi,
    ou: resolvedOu,
    budget: resolvedBudget,
    currency: currency || 'EUR',
  };

  return {
    ...resolved,
    report: buildMinimalReport(resolved),
    sections: [],
  };
}

async function completeWithAi(fields, limits) {
  const aiConfig = await SettingsService.getAiConfig();
  const providerId = aiConfig.provider;

  try {
    const result = await completeWithProvider(providerId, fields, limits, aiConfig);
    return { ...result, source: 'ai', provider: providerId, model: aiConfig.model };
  } catch (error) {
    // Toujours tracer l'échec, y compris en production : le repli heuristique
    // ne doit jamais masquer silencieusement une panne du fournisseur IA.
    console.warn(`[ai] Échec ${providerId} (${aiConfig.model}): ${error.message}`);
    console.warn('[ai] Repli sur complétion heuristique');
    return {
      ...completeWithHeuristic(fields),
      source: 'heuristic',
      provider: providerId,
      model: aiConfig.model,
    };
  }
}

export const AiService = {
  // Phase 1 : 3 idées de business (prompt en base « project_user »).
  async searchBusinesses({ quoi, ou, budget, currency = 'EUR', refine = '', avoid = [], count = 3 }) {
    const limits = CurrencyService.getBudgetLimits(currency);
    const aiConfig = await SettingsService.getAiConfig();
    const userContent = interpolate(aiConfig.userPromptTemplate, {
      quoi,
      ou,
      budget,
      currency,
      budget_min: limits.min,
      budget_max: limits.max,
      refine: refine || 'aucune',
      avoid: joinAvoid(avoid),
      count,
    });
    const data = await requestStepJson(userContent);
    return normalizeBusinesses(data.businesses).slice(0, count);
  },

  // Phase 2 : 5 lieux d'implantation (prompt en base « lieux »).
  // Le business choisi + la zone saisie (si présente) sont injectés dans le prompt.
  async searchLocations({
    business,
    businessActivity = '',
    businessPitch = '',
    businessRationale = '',
    ou,
    budget,
    currency = 'EUR',
    refine = '',
    avoid = [],
    count = 5,
  }) {
    const aiConfig = await SettingsService.getAiConfig();
    if (!aiConfig.lieuxPrompt) {
      throw new AppError('Le prompt « Lieux » est introuvable en base.', 500);
    }
    const zone = ou?.trim() || 'non précisée';
    const userContent = interpolate(aiConfig.lieuxPrompt, {
      business: business?.trim() || '',
      business_activity: businessActivity?.trim() || 'non précisé',
      business_pitch: businessPitch?.trim() || 'non précisé',
      business_rationale: businessRationale?.trim() || 'non précisé',
      ou: zone,
      budget,
      currency,
      refine: refine || 'aucune',
      avoid: joinAvoid(avoid),
      count,
    });
    const data = await requestStepJson(userContent);
    return normalizeLocations(data.locations).slice(0, count);
  },

  // Phase 3 : 3 propositions (utilisateur / flexible / idéal) + alerte budget trop élevé.
  async buildProposals({ business, location, budget, currency = 'EUR', refine = '' }) {
    const limits = CurrencyService.getBudgetLimits(currency);
    const aiConfig = await SettingsService.getAiConfig();
    if (!aiConfig.budgetPrompt) {
      throw new AppError('Le prompt « Budget » est introuvable en base.', 500);
    }
    const userContent = interpolate(aiConfig.budgetPrompt, {
      business,
      location,
      budget,
      currency,
      budget_min: limits.min,
      budget_max: limits.max,
      refine: refine || 'aucune',
    });
    const data = await requestStepJson(userContent);
    const proposals = normalizeProposals(data.proposals, currency, budget);
    const assessment = normalizeBudgetAssessment(data.budget_assessment || data.budgetAssessment);
    // Aligné sur le filtrage serveur : true seulement si une prop. « Ajusté » est bien retenue.
    assessment.adjustedProposed = proposals.some((p) => p.kind === 'budget_ajuste');
    return { proposals, assessment };
  },

  async completeProject(fields) {
    const hasQuoi = Boolean(fields.quoi?.trim());
    const hasOu = Boolean(fields.ou?.trim());
    const hasBudget = fields.budget != null && fields.budget !== '';

    if (!hasQuoi) {
      throw new AppError('Décrivez votre idée pour lancer la recherche', 400);
    }

    const currency = fields.currency || 'EUR';
    const limits = CurrencyService.getBudgetLimits(currency);

    const known = {
      quoi: fields.quoi.trim(),
      ou: hasOu ? fields.ou.trim() : null,
      budget: hasBudget ? CurrencyService.clampBudget(fields.budget, currency) : null,
      currency,
    };

    const completed = await completeWithAi(known, limits);

    return {
      quoi: known.quoi || completed.quoi,
      ou: known.ou || completed.ou,
      budget: known.budget ?? completed.budget,
      currency,
      source: completed.source,
      report: completed.report || '',
      sections: completed.sections || [],
    };
  },
};

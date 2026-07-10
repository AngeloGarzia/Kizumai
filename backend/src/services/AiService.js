import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { CurrencyService } from './CurrencyService.js';

function buildPrompt({ quoi, ou, budget, currency }, limits) {
  const parts = [];
  if (quoi) parts.push(`Quoi (connu) : ${quoi}`);
  if (ou) parts.push(`Où (connu) : ${ou}`);
  if (budget != null) parts.push(`Budget (connu) : ${budget} ${currency || 'EUR'}`);

  const missing = [];
  if (!quoi) missing.push('quoi');
  if (!ou) missing.push('ou');
  if (budget == null) missing.push('budget');

  return `Projet entrepreneurial Myrokai.
${parts.length ? parts.join('\n') : 'Aucune information fournie.'}
Complète uniquement les champs manquants : ${missing.join(', ')}.
Le budget doit être un entier entre ${limits.min} et ${limits.max} en ${currency || 'EUR'}.`;
}

import { SettingsService } from './SettingsService.js';

async function completeWithOpenAI(fields, limits) {
  const aiConfig = await SettingsService.getAiConfig();
  const needsOu = !fields.ou;
  const needsBudget = fields.budget == null;
  let systemContent = `${aiConfig.ideeSystemPrompt} Budget entier entre ${limits.min} et ${limits.max}.`;
  if (needsOu && aiConfig.lieuxPrompt) {
    systemContent += `\n\n${aiConfig.lieuxPrompt}`;
  }
  if (needsBudget && aiConfig.budgetPrompt) {
    systemContent += `\n\n${aiConfig.budgetPrompt}`;
  }
  const userContent = `${aiConfig.userPromptTemplate}\n\n${buildPrompt(fields, limits)}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ai.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError('Le service IA est temporairement indisponible', 503);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AppError('Réponse IA invalide', 502);

  const parsed = JSON.parse(content);
  return {
    quoi: String(parsed.quoi || '').trim(),
    ou: String(parsed.ou || '').trim(),
    budget: CurrencyService.clampBudget(parsed.budget, fields.currency),
  };
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

  return {
    quoi: resolvedQuoi,
    ou: resolvedOu,
    budget: resolvedBudget,
    currency: currency || 'EUR',
  };
}

export const AiService = {
  async completeProject(fields) {
    const hasQuoi = Boolean(fields.quoi?.trim());
    const hasOu = Boolean(fields.ou?.trim());
    const hasBudget = fields.budget != null && fields.budget !== '';

    if (!hasQuoi) {
      throw new AppError('Décrivez votre idée pour lancer la recherche', 400);
    }

    const currency = fields.currency || 'EUR';
    const limits = CurrencyService.getBudgetLimits(currency);
    const needsAI = !hasOu || !hasBudget;

    const known = {
      quoi: fields.quoi.trim(),
      ou: hasOu ? fields.ou.trim() : null,
      budget: hasBudget ? CurrencyService.clampBudget(fields.budget, currency) : null,
      currency,
    };

    if (!needsAI) {
      return { ...known, source: 'manual' };
    }

    let completed;
    if (config.ai.openaiApiKey) {
      completed = await completeWithOpenAI(known, limits);
    } else {
      if (config.isDev) {
        console.warn('[ai] OPENAI_API_KEY absent — complétion heuristique utilisée');
      }
      completed = completeWithHeuristic(known);
    }

    return {
      quoi: known.quoi || completed.quoi,
      ou: known.ou || completed.ou,
      budget: known.budget ?? completed.budget,
      currency,
      source: 'ai',
    };
  },
};

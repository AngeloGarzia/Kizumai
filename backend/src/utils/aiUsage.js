import { AsyncLocalStorage } from 'node:async_hooks';

/** Contexte courant d'un appel IA (userId, purpose, projectId…). */
export const aiUsageContext = new AsyncLocalStorage();

export function withAiUsageContext(ctx, fn) {
  const parent = aiUsageContext.getStore() || {};
  return aiUsageContext.run({ ...parent, ...ctx }, fn);
}

export function getAiUsageContext() {
  return aiUsageContext.getStore() || {};
}

/** Extrait prompt / completion / total selon le fournisseur. */
export function extractTokenUsage(providerId, data) {
  if (!data || typeof data !== 'object') {
    return { tokensPrompt: null, tokensCompletion: null, tokensTotal: null };
  }

  if (providerId === 'gemini') {
    const meta = data.usageMetadata || data.usage_metadata || {};
    const prompt = meta.promptTokenCount ?? meta.prompt_token_count ?? null;
    const completion =
      meta.candidatesTokenCount ??
      meta.candidates_token_count ??
      meta.outputTokenCount ??
      null;
    const total = meta.totalTokenCount ?? meta.total_token_count ?? null;
    return {
      tokensPrompt: prompt != null ? Number(prompt) : null,
      tokensCompletion: completion != null ? Number(completion) : null,
      tokensTotal:
        total != null
          ? Number(total)
          : prompt != null || completion != null
            ? Number(prompt || 0) + Number(completion || 0)
            : null,
    };
  }

  const usage = data.usage || {};
  const prompt = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const completion = usage.completion_tokens ?? usage.output_tokens ?? null;
  const total = usage.total_tokens ?? null;
  return {
    tokensPrompt: prompt != null ? Number(prompt) : null,
    tokensCompletion: completion != null ? Number(completion) : null,
    tokensTotal:
      total != null
        ? Number(total)
        : prompt != null || completion != null
          ? Number(prompt || 0) + Number(completion || 0)
          : null,
  };
}

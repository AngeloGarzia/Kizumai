/**
 * Auth Gemini Developer API (AI Studio).
 * Aligné sur la doc / curl AI Studio : header `X-goog-api-key`
 * (pas Authorization Bearer ; `?key=` en repli optionnel).
 */
export function isGeminiOAuthCredential(apiKey) {
  const k = String(apiKey || '').trim();
  return k.startsWith('AQ.') || k.startsWith('ya29.');
}

export function geminiGenerateContentUrl(modelSeg, _apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelSeg}:generateContent`;
}

export function geminiJsonHeaders(apiKey, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-goog-api-key': String(apiKey || '').trim(),
    ...extra,
  };
}

export function geminiModelsListRequest(apiKey, { pageSize = '100', pageToken = '' } = {}) {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('pageSize', pageSize);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  return {
    url: url.toString(),
    headers: { 'X-goog-api-key': String(apiKey || '').trim() },
  };
}

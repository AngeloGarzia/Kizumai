/**
 * Texte utilisateur / IA affiché en React (nœuds texte).
 * Défense en profondeur : retire contrôles / null bytes (React échappe déjà le HTML).
 */
export function sanitizeDisplayText(value, { max = 50_000 } = {}) {
  if (value == null) return '';
  let s =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
  s = s.replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (s.length > max) s = s.slice(0, max);
  return s;
}

/** Jamais utiliser pour HTML — uniquement pour attributs URL same-app. */
export function sanitizeAppPath(url) {
  if (!url || typeof url !== 'string') return '/';
  const t = url.trim();
  if (t.startsWith('/') && !t.startsWith('//') && !t.includes('\\')) {
    return t.slice(0, 500);
  }
  return '/';
}

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.md,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif';

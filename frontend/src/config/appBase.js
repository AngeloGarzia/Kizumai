/** Chemin de base public (ex. /kizumai) — aligné sur Vite `base`. */
const raw = import.meta.env.BASE_URL || '/';

export const routerBasename =
  raw === '/' ? undefined : raw.replace(/\/$/, '');

/** URL d'un fichier du dossier `public/` (logo, icônes, manifest…). */
export function publicAssetUrl(relativePath) {
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  const rel = String(relativePath || '').replace(/^\//, '');
  return `${base}${rel}`;
}

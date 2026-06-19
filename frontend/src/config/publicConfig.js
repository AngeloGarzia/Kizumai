// Seules les variables préfixées VITE_ sont exposées au client.
// Ne jamais y mettre de secrets (JWT, mots de passe, clés API privées).

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error('VITE_API_URL est requis dans le fichier .env');
}

export const publicConfig = {
  apiUrl,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};

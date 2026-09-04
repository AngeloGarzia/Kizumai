import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Corrige manifest PWA quand l'app est servie sous un sous-chemin (/kizumai/). */
function patchManifestForBase(basePath) {
  let outDir = 'dist';

  return {
    name: 'kizumai-patch-manifest',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (!basePath || basePath === '/') return;

      const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const manifestPath = join(outDir, 'manifest.webmanifest');

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.start_url = `${base}/`;
        manifest.scope = `${base}/`;
        manifest.icons = (manifest.icons || []).map((icon) => ({
          ...icon,
          src: `${base}${icon.src.startsWith('/') ? icon.src : `/${icon.src}`}`,
        }));
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      } catch {
        // manifest absent — ignore
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react(), tailwindcss(), patchManifestForBase(base)],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    build: {
      sourcemap: mode === 'development',
    },
  };
});

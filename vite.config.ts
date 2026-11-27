import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'offline-shell',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const publicFiles = ['favicon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
        const worker = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8');
        const hash = createHash('sha256').update(worker);
        for (const name of publicFiles) {
          hash.update(name).update(readFileSync(new URL(`./public/${name}`, import.meta.url)));
        }
        const assets = Object.keys(bundle).sort();
        for (const name of assets) {
          const file = bundle[name];
          hash.update(name).update(file.type === 'asset' ? file.source : file.code);
        }
        const cache = `rentmaster-shell-${hash.digest('hex').slice(0, 16)}`;
        const files = [...publicFiles, ...assets].map(name => `/${name}`);
        this.emitFile({ type: 'asset', fileName: 'sw.js', source:
          `const CACHE = ${JSON.stringify(cache)};\nconst FILES = ${JSON.stringify(files)};\n${worker}` });
      },
    },
  }],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

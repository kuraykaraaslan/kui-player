import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), minifiedCssRaw()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  // The bundled locales (`@kuraykaraaslan/kui-player/locales`). Their own entry,
// so a player left in English carries none of them and importing one does not
// drag in the other five.
// `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'react/i18n/locales/index.ts'),
      formats: ['es'],
      fileName: () => 'locales/index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@kuraykaraaslan/kui-player',
      ],
      output: {
        preserveModules: false,
        chunkFileNames: 'locales/[name].js',
        banner: '"use client";',
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
  },
});

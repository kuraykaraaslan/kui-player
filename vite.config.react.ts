import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw.ts';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), minifiedCssRaw()],
  resolve: { alias: { '@': resolve(import.meta.dirname, '.') } },
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'react/index.ts'),
      formats: ['es'],
      fileName: () => 'react/index.js',
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@kuraykaraaslan/kui-player',
      ],
      output: {
        preserveModules: false,
        // Cast / settings / about split out of the entry chunk. Everything the
        // entry loads statically goes into one shared `player.js` chunk (the
        // lazy parts import from it); without the group Rolldown would emit a
        // chunk per shared module.
        codeSplitting: { groups: [{ name: 'player', tags: ['$initial'] }] },
        chunkFileNames: 'react/[name].js',
        // The bundler strips module-level directives — re-emit it so
        // the React subpath stays a client boundary under the Next.js App Router.
        banner: '"use client";',
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
  },
});

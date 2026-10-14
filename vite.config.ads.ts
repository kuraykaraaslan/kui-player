import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname, '.') } },
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'react/ads.ts'),
      formats: ['es'],
      fileName: () => 'ads/index.js',
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@kuraykaraaslan/kui-player',
        // The player itself stays the consumer's: this entry only talks to its engine.
        '@kuraykaraaslan/kui-player/react',
      ],
      output: {
        preserveModules: false,
        chunkFileNames: 'ads/[name].js',
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

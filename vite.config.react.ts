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
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'react/index.ts'),
      formats: ['es'],
      fileName: () => 'react/index.js',
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
        // Cast / settings / about split out of the entry chunk. The shared
        // chunk rollup extracts alongside them would otherwise be `index2.js`.
        chunkFileNames: (chunk) => (chunk.name === 'index' ? 'react/player.js' : 'react/[name].js'),
        // Rollup strips module-level directives when bundling — re-emit it so
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

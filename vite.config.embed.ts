import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

// A single, fully self-contained IIFE for injection into arbitrary web pages:
// the renderer + the engine + the controls chrome + the (shadow-root) CSS, with
// NOTHING external. Nothing touches window.React, so the host page's own React
// is unaffected. Google Cast is never reachable (skin mode passes
// enableCast=false), so no gstatic script loads.
//
// The renderer here is Preact via `preact/compat`: react-dom alone is ~40 kB
// gzipped, which no page owner will accept for a set of video controls. The
// published React subpath is unaffected — this alias applies to the embed only,
// and Preact is a devDependency.
export default defineConfig({
  plugins: [react(), minifiedCssRaw()],
  resolve: {
    alias: [
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom$/,         replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react$/,             replacement: 'preact/compat' },
      { find: '@', replacement: resolve(__dirname, '.') },
    ],
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    __KUI_EMBED_VERSION__: JSON.stringify(pkg.version),
    __KUI_VERSION__: JSON.stringify(pkg.version),
  },
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'embed/index.ts'),
      formats: ['iife'],
      name: '__tepegozVideoPlayerBundle',
      fileName: () => 'embed.js',
    },
    rollupOptions: {
      external: [],
      output: { inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
  },
});

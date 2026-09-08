import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), minifiedCssRaw()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  // Vue and Svelte wrappers. Both are thin: they render a `<video>` their own
// framework owns and hand it to skin mode, so neither framework is a
// dependency of anything else here.
// `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: {
        'wrappers/vue': resolve(__dirname, 'wrappers/vue/KuiPlayer.ts'),
        'wrappers/svelte': resolve(__dirname, 'wrappers/svelte/kuiPlayer.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'vue',
        'svelte',
        '@kuraykaraaslan/kui-player',
      ],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js',
        chunkFileNames: 'wrappers/[name].js',
        banner: '"use client";',
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
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

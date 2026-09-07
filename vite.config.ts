import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'modules/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: { external: [] },
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});

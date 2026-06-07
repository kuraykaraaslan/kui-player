import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  build: {
    outDir: '../dist/demo',
    emptyOutDir: true,
  },
});

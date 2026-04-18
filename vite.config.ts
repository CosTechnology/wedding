import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/wedding/',
  publicDir: 'public',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});

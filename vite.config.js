import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути — dist/ должен работать из любой папки
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});

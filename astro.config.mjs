import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://design.voyadores.com',
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://voyadores-design-system.vercel.app',
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});

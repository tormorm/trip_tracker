// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://kaifu.ee',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: { build: { chunkSizeWarningLimit: 1500 } },
});

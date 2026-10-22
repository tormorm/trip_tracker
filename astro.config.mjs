// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  site: 'https://kaifu.ee',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      // Registered by hand in Base.astro; the manifest link is written there too
      // (with crossorigin="use-credentials", required behind basic auth).
      injectRegister: false,
      useCredentials: true,
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Vietnam & Kambodža',
        short_name: 'Reis',
        description: 'Private trip companion',
        lang: 'et',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3eadb',
        theme_color: '#f3eadb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs offline: pages, scripts, styles, fonts, icons, banknote images.
        globPatterns: ['**/*.{html,js,css,woff2,png,svg,webp,jpg,jpeg,webmanifest}'],
        globIgnores: ['api/**', 'tiles/**', 'sw-tiles.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // ?now=, ?hotel=, ?place= … all map to the same cached page.
        ignoreURLParametersMatching: [/.*/],
        directoryIndex: 'index.html',
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api\//, /^\/tiles\//],
        cleanupOutdatedCaches: true,
        importScripts: ['/sw-tiles.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/tiles/glyphs/'),
            handler: 'CacheFirst',
            options: { cacheName: 'glyphs', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  vite: {
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Serve MapLibre's worker as .js — some servers send .mjs with the wrong MIME type.
          assetFileNames: (info) =>
            (info.names?.[0] ?? info.name ?? '').endsWith('.mjs') ? '_astro/[name].[hash].js' : '_astro/[name].[hash][extname]',
        },
      },
    },
  },
});

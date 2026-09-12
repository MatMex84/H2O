import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/H2O/',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'data/idranti.geojson'],
      manifest: {
        name: 'H2O — Idranti e Risorse Idriche',
        short_name: 'H2O Idranti',
        description: 'Localizzazione e gestione rapida di idranti e risorse idriche sul territorio, 100% offline.',
        theme_color: '#0b3d5c',
        background_color: '#0b3d5c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/H2O/',
        scope: '/H2O/',
        lang: 'it',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,geojson,pmtiles}'],
        runtimeCaching: [
          {
            // Basemap raster tiles (OpenStreetMap) — cache-first so tile areas
            // already visited remain available with no connectivity.
            urlPattern: ({ url }) => /tile\.openstreetmap\.org/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-basemap-tiles',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: { enabled: true, type: 'module' }
    })
  ]
});

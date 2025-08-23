import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
         VitePWA({
       registerType: 'autoUpdate',
       includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
       manifest: {
         name: 'こごと – 身体で覚える古典単語',
         short_name: 'こごと',
         description: '視覚・聴覚・発話・表情で覚える古典単語リズム学習',
         theme_color: '#0f172a',
         background_color: '#0b1220',
         display: 'standalone',
         icons: [
           { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
           { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
           { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
         ]
       },
       workbox: {
         navigateFallback: 'index.html',
         globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,webp,woff2}'],
         runtimeCaching: [
           {
             // サイト内の /vocab.csv をキャッシュ（最新も取りに行く）
             urlPattern: ({url}) => url.origin === self.location.origin && url.pathname.endsWith('/vocab.csv'),
             handler: 'StaleWhileRevalidate',
             options: {
               cacheName: 'vocab-cache',
               expiration: { maxEntries: 3, maxAgeSeconds: 60 * 60 * 24 }
             }
           }
         ]
       },
       devOptions: { enabled: true }
     })
  ],
  
})

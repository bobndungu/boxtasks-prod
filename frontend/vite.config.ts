import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendor chunk
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management and data fetching
          'vendor-state': ['zustand', '@tanstack/react-query'],
          // Drag and drop functionality
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // UI components and icons
          'vendor-ui': ['lucide-react'],
        },
      },
    },
    // Increase warning limit slightly since we're code-splitting
    chunkSizeWarningLimit: 300,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'BoxTasks - Task Management',
        short_name: 'BoxTasks',
        description: 'A powerful task management application for teams and individuals',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude Drupal backend routes from service worker interception
        navigateFallbackDenylist: [
          /^\/api\//,       // Custom API routes
          /^\/user\//,      // Social auth routes (login, logout, callback)
          /^\/admin\//,     // Admin routes
          /^\/jsonapi\//,   // JSON:API routes
          /^\/oauth\//,     // OAuth routes
          /^\/node\//,      // Node routes
          /^\/system\//,    // System routes
          /^\/batch/,       // Batch routes
          /^\/entity\//,    // Entity routes
          /^\/media\//,     // Media routes
          /^\/sites\//,     // Sites files
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/boxtasks2\.ddev\.site\/jsonapi\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
    // Gzip compression for production
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression for modern browsers
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
})

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Plugin to generate version.json on build for cache busting detection
function generateVersionPlugin(): Plugin {
  return {
    name: 'generate-version',
    writeBundle() {
      const version = {
        version: Date.now().toString(),
        buildTime: new Date().toISOString(),
      };
      writeFileSync(
        resolve(__dirname, 'dist', 'version.json'),
        JSON.stringify(version)
      );
      console.log(`Generated version.json: ${version.version}`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Development server configuration - prevent caching issues
  server: {
    headers: {
      // Prevent browser from caching any responses in development
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
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
      registerType: 'autoUpdate', // Auto-update ensures users always get the latest version
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      // Disable service worker in development to avoid caching issues
      selfDestroying: false,
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
        // Only precache the main HTML and essential assets - NOT all JS chunks
        // This prevents 404 errors when old SWs try to fetch renamed chunks
        globPatterns: ['**/*.{html,ico,png,svg,woff,woff2}'],
        // CRITICAL: These options ensure new deployments take effect immediately
        skipWaiting: true,           // New SW activates immediately, doesn't wait for tabs to close
        clientsClaim: true,          // New SW takes control of all clients immediately
        cleanupOutdatedCaches: true, // Automatically remove old precache versions
        // Disable workbox logs in production
        disableDevLogs: true,
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
          // IMPORTANT: Do NOT cache JS/CSS files via service worker!
          // Vite adds content hashes to filenames (e.g., index-abc123.js)
          // This means browser caching is sufficient and safe.
          // Service worker caching of JS/CSS causes stale code issues.
          {
            // Only cache Google Fonts (safe to cache long-term)
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
          {
            // Cache font files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache images only (safe to cache)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        // IMPORTANT: Disable service worker in development to prevent caching issues
        // This was causing features to not appear after code changes
        enabled: false,
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
    // Generate version.json for cache busting detection
    generateVersionPlugin(),
  ],
})

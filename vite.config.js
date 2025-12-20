import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const manifest = {
  name: 'Coursati',
  short_name: 'Coursati',
  start_url: '/',
  display: 'standalone',
  background_color: '#020617',
  theme_color: '#06b6d4',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'robots.txt',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-192-maskable.png',
        'icons/icon-512-maskable.png'
      ],
      manifest,
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'offline-cache',
              expiration: { maxEntries: 200 }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom'
    ],
    // Prevent server-only packages (and Babel parser) from being pre-bundled into the client build
    exclude: [
      '@babel/parser',
      'workbox-build',
      '@rollup/plugin-babel'
    ]
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/auth': 'http://localhost:5000',
    }
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    brotliSize: false,
    target: 'es2018',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
            if (id.includes('hls.js')) return 'vendor-hls';
            if (id.includes('axios')) return 'vendor-axios';
            if (id.includes('react-toastify')) return 'vendor-toast';
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
}))

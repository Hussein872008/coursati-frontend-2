import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
    }),
  ],

  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Proxy /api requests to backend during local development so SSE and API calls reach the server
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@babel/parser', 'workbox-build', '@rollup/plugin-babel'],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' zodat de app ook in een submap werkt (bijv. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Speelminuten AH 1',
        short_name: 'Speelminuten',
        description: 'Speelminuten en statistieken van het 1e elftal van AmstelveenHeemraad',
        lang: 'nl',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f4f6f4',
        theme_color: '#14532d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
});

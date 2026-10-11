import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WoCow — Person 5 (integration) owns this file.
export default defineConfig({
  plugins: [react()],

  server: {
    // host:true lets teammates open the dev server from a phone on the same
    // Wi-Fi — genuinely useful when four people are testing at once.
    host: true,
    port: 5173,
  },

  build: {
    rollupOptions: {
      output: {
        // Leaflet and Supabase are both large and change far less often than
        // WoCow's own code. Splitting them out keeps the app chunk small and
        // lets a browser cache them across deploys.
        //
        // MapPage is also lazy-loaded in App.tsx, so Leaflet only downloads
        // for users who actually open the Map tab.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})

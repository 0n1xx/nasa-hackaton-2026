import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const inPkg = (id: string, names: string[]) => names.some((n) => id.includes(`/node_modules/${n}/`))

// The browser only ever talks to /api on our own backend; secrets stay server-side.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': `http://localhost:${process.env.PORT ?? 8787}` } },
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than our code: in their own files a returning visitor's browser
        // keeps them cached across deploys. The map library loads only when a map is drawn (LazyHeroMap).
        manualChunks(id) {
          if (inPkg(id, ['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', '@remix-run/router'])) return 'react'
          if (inPkg(id, ['leaflet', 'react-leaflet', '@react-leaflet/core'])) return 'leaflet'
        },
      },
    },
  },
})

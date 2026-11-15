import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The browser only ever talks to /api on our own backend; secrets stay server-side.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': `http://localhost:${process.env.PORT ?? 8787}` } },
})

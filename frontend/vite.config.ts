import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward /api requests to the Laravel backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Forward uploaded files (storage/app/public) to the Laravel backend
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Menu artwork is served by the backend rather than bundled here, because
      // mobile resolves a stored `image_url` against the API origin. Scoped to
      // /images/menu so /images/logo-mark.png keeps resolving locally. Mirrors
      // the `location /images/menu` block in nginx.conf.
      '/images/menu': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

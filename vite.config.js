import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/sim-proxy': {
        target: 'https://api.nostradamus-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sim-proxy/, ''),
      },
      '/pipeline-proxy': {
        target: 'https://pipeline-demo.nostradamus-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pipeline-proxy/, ''),
      },
    },
  },
})
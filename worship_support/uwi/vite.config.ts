import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // must come before react()
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  server: {
    // container: reachable through the compose port mapping
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': `http://api:${process.env.DEVELOP_API_CONTAINER_PORT}`,
    },
  },
})

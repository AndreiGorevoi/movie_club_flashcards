import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // В разработке фронт живёт на 5173, а API — на 3000 (npm run dev:api).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

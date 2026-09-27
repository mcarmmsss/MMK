import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/MMK/' : '/',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/SVG/**'],
    },
  },
})

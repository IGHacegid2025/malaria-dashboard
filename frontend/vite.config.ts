import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const apiPort = process.env.API_PORT ?? '8000'

function siteUrl(): Plugin {
  const site = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '')
  return {
    name: 'site-url',
    transformIndexHtml: (html) => (site ? html.replaceAll('__SITE_URL__', site) : html),
  }
}

export default defineConfig({
  plugins: [react(), siteUrl()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
})

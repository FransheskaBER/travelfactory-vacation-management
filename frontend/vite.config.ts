import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [vue(), tailwindcss()],
    server: {
      // Honor an assigned dev port (e.g. launch.json autoPort) — Vite does
      // not read PORT on its own. Cookie + proxy behavior is port-agnostic.
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      // Mandatory since the httpOnly-cookie migration, not a convenience:
      // credentialed requests forbid Access-Control-Allow-Origin: *, and the
      // CEF dev server's preflight hardcodes exactly that (verified in
      // dist/dev/requestListener.js). Proxying makes API calls same-origin,
      // so CORS never applies and the auth cookie flows on its own.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8888',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})

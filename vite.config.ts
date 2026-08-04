import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Adjust VITE_API_PROXY_TARGET in .env to point at your MediaFeed backend.
        '/api': { target: proxyTarget, changeOrigin: true },
        '/hls-proxy': { target: proxyTarget, changeOrigin: true },
        '/local-media': { target: proxyTarget, changeOrigin: true },
        '/hls-auth': { target: proxyTarget, changeOrigin: true },
        '/img-auth': { target: proxyTarget, changeOrigin: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
  };
})

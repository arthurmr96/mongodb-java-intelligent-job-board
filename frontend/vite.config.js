import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration for the Intelligent Job Matching frontend.
 *
 * The `/api` proxy forwards all requests with that prefix to the Spring Boot
 * backend running on port 8080. This eliminates CORS friction in development
 * without any additional configuration on the backend.
 *
 * In production (Docker Compose), the same `/api` prefix is handled by the
 * nginx reverse proxy that sits in front of both services.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Strip the /api prefix before forwarding to Spring Boot
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

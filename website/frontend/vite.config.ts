import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Never manufacture products or successful orders when the backend is unavailable.
// UI fixtures belong in Playwright routes.
const target = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000';
const backendUrl = new URL(target);
if (backendUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(backendUrl.hostname)) {
  throw new Error('API_PROXY_TARGET must be a loopback HTTP backend.');
}
const proxy = { '/api/': { target } };

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
});

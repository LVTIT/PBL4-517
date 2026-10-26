import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Never manufacture products or successful orders when the backend is unavailable.
// UI fixtures belong in Playwright routes.
const proxy = { '/api/': { target: 'http://127.0.0.1:3000' } };

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
});

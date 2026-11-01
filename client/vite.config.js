import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Keeps the session cookie first-party during development.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 2026-09-17 (Anh chốt): Cấu hình proxy /api về NestJS backend port 3000 phục vụ dev
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

import path from 'path';
import { defineConfig } from 'vite'; // Xóa 'loadEnv'
import react from '@vitejs/plugin-react';

export default defineConfig(() => { // Xóa '{ mode }' và 'const env = ...'
    return {
      base: './', // Giữ cái này nếu ông deploy vào thư mục con, hoặc đổi thành '/' nếu ở thư mục gốc
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      
      // ===== XÓA TOÀN BỘ KHỐI 'define' NÀY =====
      // define: {
      //   'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      //   'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      // },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
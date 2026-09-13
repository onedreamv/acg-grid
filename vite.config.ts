import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const UA = 'dream/acg-grid/0.1.0 (https://grid.1dream.online)';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发期直连 bangumi（生产由 Worker 反代接管），changeOrigin 必须显式开启，
      // 且 dev server 发出的请求属非浏览器调用方，必须注入规范 UA。
      // 与 Worker 同款剥前缀行为：/api/v0/x → https://api.bgm.tv/v0/x
      '/api': {
        target: 'https://api.bgm.tv',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: { 'User-Agent': UA },
      },
      '/img': {
        target: 'https://lain.bgm.tv',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/img/, ''),
        headers: { 'User-Agent': UA },
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const packagePath = id.replace(/\\/g, '/');
          if (/\/(recharts|d3-[^/]+|victory-vendor)\//.test(packagePath)) return 'charts';
          if (/\/(antd|@ant-design|@rc-component|rc-[^/]+)\//.test(packagePath)) return 'antd';
          return 'vendor';
        },
      },
    },
  },
});

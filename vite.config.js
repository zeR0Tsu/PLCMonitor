import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function resolveBackendPort() {
  if (process.env.BACKEND_PORT) return Number(process.env.BACKEND_PORT);
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'config.json'), 'utf-8');
    return Number(JSON.parse(raw).server?.port) || 3000;
  } catch (_) {
    return 3000;
  }
}

const backendTarget = `http://127.0.0.1:${resolveBackendPort()}`;

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  base: './',
  build: {
    // 必须是项目根的 frontend/dist；相对 frontend 根解析会生成 frontend/frontend/dist
    outDir: path.join(projectRoot, 'frontend', 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/socket.io': { target: backendTarget, ws: true },
      '/api': { target: backendTarget },
    },
  },
});

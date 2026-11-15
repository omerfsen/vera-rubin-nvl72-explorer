/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from a sub-path of an existing site, so the public base
// path comes from VITE_BASE_PATH (default "/").
export function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value === '' || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: normalizeBase(env.VITE_BASE_PATH),
    plugins: [react()],
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1500,
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});

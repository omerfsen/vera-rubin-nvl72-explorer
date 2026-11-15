/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from a sub-path of an existing site, so the public base
// path comes from VITE_BASE_PATH (default "/").
export function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  // Vite also accepts a full URL or "./" (relative); pass those through.
  if (/^https?:\/\//i.test(value)) return value.endsWith('/') ? value : `${value}/`;
  if (value === './' || value === '.') return './';
  const segments = value.split('/').filter((s) => s !== '' && s !== '.');
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
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

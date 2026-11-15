/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/** Publish the dataset and its schema next to the app, so others can reuse them. */
function publishData() {
  return {
    name: 'publish-data',
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      for (const f of ['nvl72-topology.json', 'nvl72-topology.schema.json']) {
        this.emitFile({ type: 'asset', fileName: `data/${f}`, source: readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8') });
      }
    },
  };
}

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
    plugins: [react(), publishData()],
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

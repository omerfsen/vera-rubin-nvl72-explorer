// Bundles the stdio server into one file with its dependencies and the data.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'mcp/stdio.ts',
    outDir: 'mcp/dist',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'vr-nvl72-mcp.mjs', banner: '#!/usr/bin/env node' } },
  },
  ssr: { noExternal: true, target: 'node' },
});

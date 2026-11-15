/**
 * Local entry: serves the read-only dataset over stdio. stdout carries only
 * MCP messages; everything else goes to stderr.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const HELP = `vr-nvl72-mcp ${SERVER_VERSION}: read-only MCP server for the NVIDIA DGX Vera Rubin NVL72 rack data.

Usage: node mcp/dist/vr-nvl72-mcp.mjs [-h | -v]

Speaks MCP on stdin/stdout; add it to an MCP client as a stdio server.
  -h, --help     show this help
  -v, --version  print the version
Unofficial; not affiliated with or endorsed by NVIDIA.`;

const arg = process.argv[2];
if (arg === '-h' || arg === '--help') {
  process.stderr.write(`${HELP}\n`);
  process.exit(0);
} else if (arg === '-v' || arg === '--version') {
  process.stderr.write(`${SERVER_VERSION}\n`);
  process.exit(0);
} else if (arg !== undefined) {
  process.stderr.write(`unknown argument: ${arg} (try -h)\n`);
  process.exit(2);
}

const handle = serveStdio(() => createServer());
process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION} ready on stdio\n`);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void handle.close().finally(() => process.exit(0));
  });
}

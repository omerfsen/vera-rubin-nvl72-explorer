// Connects to a deployed /mcp with the official SDK client, as an MCP host
// would, and runs a few read-only questions. Usage:
//   node scripts/mcp-live.mjs [https://verarubin-nvl72.faruk.net/mcp]
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import assert from 'node:assert/strict';

const url = new URL(process.argv[2] ?? 'https://verarubin-nvl72.faruk.net/mcp');
const client = new Client({ name: 'vr-nvl72-live-check', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
await client.connect(new StreamableHTTPClientTransport(url));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  assert.ok(!r.isError, `${name}: ${r.content?.[0]?.text}`);
  return r.structuredContent;
};

const { tools } = await client.listTools();
console.log(`connected to ${url}: ${tools.length} tools`);
const o = await call('nvl72_overview');
const gpus = o.totalsPerRack.find((t) => t.component === 'rubin-gpu').total;
console.log(`GPUs per rack: ${gpus}`);
assert.equal(gpus, 72);
const s = await call('nvl72_search', { query: 'bluefield' });
console.log(`search "bluefield": ${s.results[0].id}`);
const tray = await call('nvl72_rack_layout', { unit: 'compute-tray' });
const t7 = tray.units.find((u) => u.number === 7);
console.log(`compute tray 7 starts ${t7.topRU} RU from the top`);
const cmd = await call('nvl72_get_command', { command: 'power-cycle-host' });
console.log(`power-cycle-host: ${cmd.command.command.split('\n')[0].slice(0, 70)}...`);
const bad = await client.callTool({ name: 'nvl72_get_component', arguments: { component: '../etc/passwd' } });
assert.equal(bad.isError, true);
console.log('hostile id refused');
await client.close();
console.log('live check passed');

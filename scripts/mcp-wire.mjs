// Raw JSON-RPC against the built stdio server (mcp/dist/vr-nvl72-mcp.mjs).
// The SDK implements the protocol, so this checks the wire, not our code:
// spec 2026-07-28 discover, cache hints, serverInfo, validation, stdout
// carrying only JSON-RPC, and exit when stdin closes.
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BIN = 'mcp/dist/vr-nvl72-mcp.mjs';
const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
const req = (id, method, params = {}) => JSON.stringify({ jsonrpc: '2.0', id, method, params: { _meta: META, ...params } });

for (const flag of ['-h', '-v']) {
  const r = spawnSync('node', [BIN, flag], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${flag} exits 0`);
  assert.equal(r.stdout, '', `${flag} writes nothing to stdout`);
  assert.ok(r.stderr.length > 0, `${flag} answers on stderr`);
}
assert.equal(spawnSync('node', [BIN, '--bogus']).status, 2, 'unknown flag exits 2');

const child = spawn('node', [BIN], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => (out += d));
const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
child.stdin.write(
  [
    req(1, 'server/discover'),
    req(2, 'tools/list'),
    req(3, 'tools/call', { name: 'nvl72_get_component', arguments: { component: 'rubin-gpu' } }),
    req(4, 'tools/call', { name: 'nvl72_get_component', arguments: { component: '../etc/passwd' } }),
    req(5, 'tools/call', { name: 'no_such_tool', arguments: {} }),
  ].join('\n') + '\n',
);
// Give the server time to answer, then close stdin: it must exit on its own.
await new Promise((r) => setTimeout(r, 1500));
child.stdin.end();
const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r('timeout'), 5000))]);
if (code === 'timeout') child.kill('SIGKILL');

const lines = out.trim().split('\n');
const msgs = lines.map((l) => JSON.parse(l)); // throws if stdout holds anything but JSON
const byId = Object.fromEntries(msgs.map((m) => [m.id, m]));
const NAME = 'io.github.omerfsen/vera-rubin-nvl72-explorer';

const d = byId[1].result;
assert.equal(d.resultType, 'complete');
assert.deepEqual(d.supportedVersions, ['2026-07-28']);
assert.deepEqual(d.capabilities.tools, { listChanged: false });
assert.equal(d._meta['io.modelcontextprotocol/serverInfo'].name, NAME);

const l = byId[2].result;
assert.equal(l.ttlMs, 3600000);
assert.equal(l.cacheScope, 'public');
assert.equal(l.tools.length, 9);
assert.ok(l.tools.every((t) => t.annotations.readOnlyHint === true));

const g = byId[3].result;
assert.equal(g.isError, undefined);
assert.equal(g.structuredContent.totalPerRack, 72);
assert.deepEqual(JSON.parse(g.content[0].text), g.structuredContent);

assert.equal(byId[4].result.isError, true);
assert.match(byId[4].result.content[0].text, /Input validation error/);
assert.ok(byId[5].error, 'unknown tool is a JSON-RPC error');

assert.equal(code, 0, `exits 0 when stdin closes (got ${code})`);
console.log(`mcp wire: ${lines.length} responses, all checks passed`);

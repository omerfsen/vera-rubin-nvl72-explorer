// MCP server tests over a real client session: the SDK runs the schemas, so
// hostile arguments are rejected exactly as they would be in production.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import raw from '../data/nvl72-topology.json' with { type: 'json' };
import { handle } from '../mcp/http';
import { RateLimiter } from '../mcp/ratelimit';
import { createServer } from '../mcp/server';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { Topology } from '../src/data/types';

const topology = raw as unknown as Topology;
const URL_ = 'https://verarubin-nvl72.faruk.net/mcp';
const clients: Client[] = [];

/** A client talking to the real HTTP entry (all checks included), in process. */
async function connect(fetchImpl: (req: Request) => Promise<Response> = handle, ip = `10.0.0.${Math.floor(Math.random() * 250)}`) {
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    fetch: (url, init) => {
      const req = new Request(url, init);
      req.headers.set('x-real-ip', ip);
      return fetchImpl(req);
    },
  });
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(transport);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as { isError?: boolean; structuredContent?: any; content: { type: string; text: string }[] };

describe('MCP tool surface', () => {
  it('lists ten read-only tools in a fixed order with full metadata', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      'nvl72_overview',
      'nvl72_search',
      'nvl72_get_component',
      'nvl72_get_network',
      'nvl72_rack_layout',
      'nvl72_get_procedure',
      'nvl72_get_command',
      'nvl72_pcie_devices',
      'nvl72_open_questions',
      'nvl72_glossary',
    ]);
    for (const t of tools) {
      expect(t.name.length).toBeLessThanOrEqual(64);
      expect(t.title).toBeTruthy();
      expect(t.description!.length).toBeGreaterThan(120);
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
      expect(t.inputSchema.additionalProperties).toBe(false);
      expect(t.outputSchema).toBeTruthy();
      for (const [name, p] of Object.entries((t.inputSchema.properties ?? {}) as Record<string, { description?: string }>)) {
        expect(p.description, `${t.name}.${name}`).toBeTruthy();
      }
    }
  });

  it('answers every part in the data with sources', async () => {
    // 56 calls is over the public per-IP limit, so use a server with a wide one.
    const limiter = new RateLimiter({ capacity: 1000, refillPerSecond: 1000 });
    const h = createMcpHandler(() => createServer({ limiter }));
    const client = await connect((req) => h.fetch(req));
    for (const c of topology.components) {
      const r = await call(client, 'nvl72_get_component', { component: c.id });
      expect(r.isError, c.id).toBeFalsy();
      expect(r.structuredContent.source.url).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-/);
      for (const s of r.structuredContent.specs) expect(s.source.url, `${c.id} ${s.label}`).toMatch(/^https:\/\/docs\.nvidia\.com\//);
    }
  });

  it('gives the per-rack totals the documents state', async () => {
    const client = await connect();
    const gpu = await call(client, 'nvl72_get_component', { component: 'rubin-gpu' });
    expect(gpu.structuredContent.totalPerRack).toBe(72);
    expect(gpu.structuredContent.explorer).toBe('https://verarubin-nvl72.faruk.net/?select=compute-tray%2Frubin-gpu');
    const o = await call(client, 'nvl72_overview');
    expect(o.structuredContent.units).toEqual(
      expect.arrayContaining([expect.objectContaining({ component: 'compute-tray', count: 18 }), expect.objectContaining({ component: 'switch-tray', count: 9 })]),
    );
    expect(JSON.parse(o.content[0]!.text)).toEqual(o.structuredContent);
  });

  it('search returns ids for the get tools', async () => {
    const client = await connect();
    const r = await call(client, 'nvl72_search', { query: 'BlueField' });
    expect(r.structuredContent.results[0]).toMatchObject({ kind: 'component', id: 'bluefield-4', next: 'nvl72_get_component' });
    const bus = await call(client, 'nvl72_search', { query: '0001:03:00.0' });
    expect(bus.structuredContent.results[0]).toMatchObject({ kind: 'pcie', id: 'ct-port-cx9-osfp' });
    const none = await call(client, 'nvl72_search', { query: 'zzzz' });
    expect(none.structuredContent).toEqual({ results: [], truncated: false });
  });

  it('lists procedures and commands without an id, and quotes a command verbatim', async () => {
    const client = await connect();
    const list = await call(client, 'nvl72_get_command');
    expect(list.structuredContent.commands).toHaveLength(topology.commands!.length);
    const one = await call(client, 'nvl72_get_command', { command: 'power-cycle-host' });
    expect(one.structuredContent.command.command).toBe(topology.commands!.find((c) => c.id === 'power-cycle-host')!.command);
    const reset = await call(client, 'nvl72_get_command', { command: 'reset-bmc-to-factory-defaults' });
    expect(reset.structuredContent.factoryReset).toMatch(/default username/);
    const p = await call(client, 'nvl72_get_procedure', { procedure: 'psu' });
    expect(p.structuredContent.procedure.steps[0]).toMatchObject({ number: 1 });
    expect(p.structuredContent.procedure.explorer).toContain('proc=psu');
  });

  it('networks, layout, PCIe and open questions', async () => {
    const client = await connect();
    const n = await call(client, 'nvl72_get_network', { network: 'computenet' });
    expect(n.structuredContent.fabric).toBe('InfiniBand');
    const l = await call(client, 'nvl72_rack_layout', { unit: 'power-shelf' });
    expect(l.structuredContent.units.map((u: { number: number }) => u.number)).toEqual([4, 3, 2, 1]);
    const pcie = await call(client, 'nvl72_pcie_devices', { component: 'ct-port-cx9-osfp' });
    expect(pcie.structuredContent.rows.length).toBeGreaterThan(0);
    const q = await call(client, 'nvl72_open_questions', { kind: 'conflict' });
    expect(q.structuredContent.questions.every((x: { kind: string }) => x.kind === 'conflict')).toBe(true);
  });

  it('glossary lists every term with its source, or one by id', async () => {
    const client = await connect();
    const all = await call(client, 'nvl72_glossary');
    expect(all.structuredContent.terms).toHaveLength(topology.glossary!.length);
    for (const g of all.structuredContent.terms) expect(g.source.url).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-/);
    const bmc = await call(client, 'nvl72_glossary', { id: 'bmc' });
    expect(bmc.structuredContent.terms).toEqual([expect.objectContaining({ term: 'BMC', expansion: 'Board Management Controller' })]);
  });
});

describe('hostile arguments are refused before any handler runs', () => {
  it.each([
    ['nvl72_get_component', { component: '../../etc/passwd' }],
    ['nvl72_get_component', { component: 'rubin-gpu', extra: 1 }],
    ['nvl72_get_component', {}],
    ['nvl72_search', { query: 'x'.repeat(81) }],
    ['nvl72_search', { query: '' }],
    ['nvl72_search', { query: 'gpu', limit: 999 }],
    ['nvl72_get_network', { network: 'internet' }],
    ['nvl72_open_questions', { kind: 'everything' }],
    ['nvl72_overview', { anything: true }],
    ['nvl72_glossary', { id: 'not-a-term' }],
    ['nvl72_glossary', { id: 'bmc', definition: 'x' }],
  ])('%s %j', async (name, args) => {
    const client = await connect();
    const r = await call(client, name, args);
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Input validation error/);
  });

  it('an unknown tool is a protocol error', async () => {
    const client = await connect();
    await expect(client.callTool({ name: 'nvl72_delete_everything', arguments: {} })).rejects.toThrow(/not found/);
  });
});

describe('rate limits', () => {
  it('the token bucket refills over time', () => {
    let t = 0;
    const rl = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: () => t });
    expect(rl.take('a')).toBe(0);
    expect(rl.take('a')).toBe(0);
    expect(rl.take('a')).toBe(1000);
    expect(rl.take('b')).toBe(0);
    t = 1000;
    expect(rl.take('a')).toBe(0);
  });

  it('keeps at most maxKeys buckets', () => {
    const rl = new RateLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2, now: () => 0 });
    rl.take('a');
    rl.take('b');
    rl.take('c');
    expect(rl.take('a')).toBe(0);
  });

  it('a tool call over the limit comes back as an error naming the wait', async () => {
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0.5 });
    const h = createMcpHandler(() => createServer({ limiter, rateKey: 'x' }));
    const client = await connect((req) => h.fetch(req));
    expect((await call(client, 'nvl72_overview')).isError).toBeFalsy();
    const r = await call(client, 'nvl72_overview');
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Rate limit reached: retry in 2 s/);
  });
});

describe('HTTP entry checks', () => {
  const post = (headers: Record<string, string> = {}, url = URL_) =>
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: '{}' });

  it('takes POST only', async () => {
    const r = await handle(new Request(URL_));
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
  });

  it('refuses a foreign Host or Origin', async () => {
    expect((await handle(post({}, 'https://evil.example/mcp'))).status).toBe(403);
    expect((await handle(post({ origin: 'https://evil.example' }))).status).toBe(403);
  });

  it('refuses a body over 64 KiB', async () => {
    expect((await handle(post({ 'content-length': String(65 * 1024) }))).status).toBe(413);
  });

  it('answers 429 with Retry-After once an IP has used its burst', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 61; i++) last = await handle(post({ 'x-real-ip': '192.0.2.77' }));
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});

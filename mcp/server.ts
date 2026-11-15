/**
 * Read-only MCP server over the explorer's dataset (data/nvl72-topology.json).
 * Every fact it returns carries the NVIDIA document section it came from.
 * The same factory serves stdio (mcp/stdio.ts) and HTTP (api/mcp.ts).
 */
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import raw from '../data/nvl72-topology.json' with { type: 'json' };
import { createModel } from '../src/data/model.js';
import type { Component, Topology } from '../src/data/types.js';
import { RateLimiter } from './ratelimit.js';

export const SERVER_NAME = 'io.github.omerfsen/vera-rubin-nvl72-explorer';
export const SERVER_VERSION = '1.0.0';
export const SITE = 'https://verarubin-nvl72.faruk.net/';

const topology = raw as unknown as Topology;
const model = createModel(topology);

// ---- enums from the data, so no argument is free text that names a thing ----
type NonEmpty = [string, ...string[]];
const ids = <T extends { id: string }>(xs: readonly T[] | undefined) => (xs ?? []).map((x) => x.id) as NonEmpty;
const COMPONENT_IDS = ids(topology.components);
const NETWORK_IDS = ids(topology.networks);
const PROCEDURE_IDS = ids(topology.procedures);
const COMMAND_IDS = ids(topology.commands);
const RACK_UNIT_IDS = [...new Set(model.rackUnits.map((u) => u.componentId))] as NonEmpty;
const PCIE_COMPONENT_IDS = [...new Set((topology.pcieDevices ?? []).map((r) => r.component))] as NonEmpty;

// ---- output shapes ----
const SourceZ = z.object({ url: z.string(), section: z.string(), figure: z.string().optional() });
const ProvZ = { source: SourceZ, assumed: z.boolean().optional(), note: z.string().optional() };
const RefZ = z.object({
  document: z.enum(['user-guide', 'service-manual']),
  section: z.string(),
  html: z.string(),
  pdf: z.string().optional(),
  figures: z.array(z.string()).optional(),
});
const SpecZ = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  source: SourceZ,
  assumed: z.boolean().optional(),
  note: z.string().optional(),
});
const ConnZ = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string().optional(),
  network: z.string().optional(),
  kind: z.string(),
  description: z.string(),
  alternative: z.boolean().optional(),
  ...ProvZ,
});
const PcieZ = z.object({
  label: z.string(),
  bus: z.string(),
  interface: z.string().optional(),
  rdma: z.string().optional(),
  component: z.string(),
  index: z.number().optional(),
  source: SourceZ,
});
const CommandSummaryZ = z.object({ id: z.string(), title: z.string(), group: z.string() });
const SafetyZ = z.object({ id: z.string(), title: z.string(), text: z.string(), source: SourceZ });
const QuestionZ = z.object({
  id: z.string(),
  kind: z.enum(['conflict', 'gap']),
  title: z.string(),
  summary: z.string(),
  components: z.array(z.string()),
  details: z.string(),
});

// ---- helpers ----
const explorerLink = (query: Record<string, string>) => `${SITE}?${new URLSearchParams(query).toString()}`;

/** A spec's own source, or the component's when it has none (the data model's rule). */
const specOut = (c: Component) => c.specs.map((s) => ({ ...s, source: s.source ?? c.source }));

const strip = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

function ok(structured: Record<string, unknown>): CallToolResult {
  const clean = strip(structured);
  return { content: [{ type: 'text', text: JSON.stringify(clean) }], structuredContent: clean };
}

function fail(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

export interface ServerOptions {
  /** Shared limiter; one is made per server when omitted. */
  limiter?: RateLimiter;
  /** Caller key for the limiter, e.g. the client IP over HTTP. */
  rateKey?: string;
}

/** Default: 30 calls at once, then 5 per second, per caller. */
export const defaultLimiter = () => new RateLimiter({ capacity: 30, refillPerSecond: 5 });

const INSTRUCTIONS =
  'Facts about the NVIDIA DGX Vera Rubin NVL72 rack, taken only from NVIDIA\'s DGX VR NVL72 User Guide and Service Manual. ' +
  'Every fact carries its document section; "assumed": true marks a reading the documents do not state. ' +
  'Unofficial: not affiliated with or endorsed by NVIDIA. Product names are trademarks of NVIDIA Corporation.';

export function createServer(opts: ServerOptions = {}): McpServer {
  const limiter = opts.limiter ?? defaultLimiter();
  const key = opts.rateKey ?? 'local';
  const limited = (): CallToolResult | null => {
    const wait = limiter.take(key);
    return wait === 0 ? null : fail(`Rate limit reached: retry in ${Math.ceil(wait / 1000)} s.`);
  };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: 'Vera Rubin NVL72 Explorer', websiteUrl: SITE },
    {
      instructions: INSTRUCTIONS,
      // The SDK defaults listChanged to true unless it is set; this list never changes.
      capabilities: { tools: { listChanged: false } },
      maxToolInputElements: 16,
      cacheHints: { 'tools/list': { ttlMs: 3_600_000, cacheScope: 'public' } },
    },
  );

  server.registerTool(
    'nvl72_overview',
    {
      title: 'Rack overview',
      description:
        'Summarises the whole DGX Vera Rubin NVL72 rack: the source documents and their dates, the units in the rack with how many of each, per-rack totals of the main parts (GPUs, CPUs, NICs, switch ASICs, PSUs), and the seven networks. Takes no arguments and changes nothing. Start here; use nvl72_get_component for one part, nvl72_rack_layout for positions in the rack.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({
        title: z.string(),
        documents: z.array(z.object({ title: z.string(), date: z.string(), urls: z.array(z.string()) })),
        totalRU: z.number(),
        units: z.array(z.object({ component: z.string(), name: z.string(), count: z.number() })),
        totalsPerRack: z.array(z.object({ component: z.string(), name: z.string(), total: z.number().nullable() })),
        networks: z.array(z.object({ id: z.string(), name: z.string(), fabric: z.string().nullable() })),
        explorer: z.string(),
        disclaimer: z.string(),
      }),
      annotations: { title: 'Rack overview', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const stop = limited();
      if (stop) return stop;
      const m = topology.meta;
      const docs = [m.document, ...(m.serviceManual ? [m.serviceManual] : [])].map((d) => ({ title: d.title, date: d.date, urls: d.urls }));
      const totals = ['rubin-gpu', 'vera-cpu', 'connectx-9', 'bluefield-4', 'nvswitch-asic', 'psu', 'socamm']
        .filter((id) => model.getComponent(id))
        .map((id) => ({ component: id, name: model.getComponent(id)!.name, total: model.totalPerRack(id) }));
      return ok({
        title: m.title,
        documents: docs,
        totalRU: model.totalRU,
        units: RACK_UNIT_IDS.map((id) => ({
          component: id,
          name: model.getComponent(id)!.name,
          count: model.rackUnits.filter((u) => u.componentId === id).length,
        })),
        totalsPerRack: totals,
        networks: topology.networks.map((n) => ({ id: n.id, name: n.name, fabric: n.fabric })),
        explorer: SITE,
        disclaimer: 'Unofficial; not affiliated with or endorsed by NVIDIA. Product names are trademarks of NVIDIA Corporation.',
      });
    },
  );

  server.registerTool(
    'nvl72_search',
    {
      title: 'Search the rack data',
      description:
        'Finds parts, networks, procedures, BMC commands and PCIe rows whose name, id, description, label, bus address or interface name contain every word of the query (case-insensitive). Returns ids to pass to the nvl72_get_* tools, best matches first; it does not return the facts themselves. Use it when you do not know the exact id; use nvl72_get_component directly when you do.',
      inputSchema: z
        .object({
          query: z.string().min(1).max(80).describe('Words to look for, e.g. "bluefield port" or "0001:03:00.0". Up to 80 characters.'),
          limit: z.number().int().min(1).max(25).default(10).describe('Most results to return, 1 to 25.'),
        })
        .strict(),
      outputSchema: z.object({
        results: z.array(
          z.object({
            kind: z.enum(['component', 'network', 'procedure', 'command', 'pcie']),
            id: z.string(),
            title: z.string(),
            next: z.string(),
          }),
        ),
        truncated: z.boolean(),
      }),
      annotations: { title: 'Search the rack data', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const stop = limited();
      if (stop) return stop;
      const words = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
      if (words.length === 0) return fail('The query is empty: give one or more words, e.g. "gpu" or "bluefield port".');
      type Hit = { kind: 'component' | 'network' | 'procedure' | 'command' | 'pcie'; id: string; title: string; next: string; score: number };
      const hits: Hit[] = [];
      const score = (title: string, ...rest: (string | undefined)[]) => {
        const t = title.toLowerCase();
        const all = [t, ...rest.map((r) => (r ?? '').toLowerCase())].join(' \u0000 ');
        if (!words.every((w) => all.includes(w))) return 0;
        return 1 + words.filter((w) => t.includes(w)).length * 2 + (t === words.join(' ') ? 5 : 0);
      };
      for (const c of topology.components) {
        const s = score(c.name, c.id, c.type, c.description, c.function);
        if (s) hits.push({ kind: 'component', id: c.id, title: c.name, next: 'nvl72_get_component', score: s + 1 });
      }
      for (const n of topology.networks) {
        const s = score(n.name, n.id, n.description, n.fabric ?? '');
        if (s) hits.push({ kind: 'network', id: n.id, title: n.name, next: 'nvl72_get_network', score: s + 1 });
      }
      for (const p of topology.procedures ?? []) {
        const s = score(p.title, p.id, p.component);
        if (s) hits.push({ kind: 'procedure', id: p.id, title: p.title, next: 'nvl72_get_procedure', score: s });
      }
      for (const c of topology.commands ?? []) {
        const s = score(c.title, c.id, c.group, c.purpose);
        if (s) hits.push({ kind: 'command', id: c.id, title: c.title, next: 'nvl72_get_command', score: s });
      }
      for (const r of topology.pcieDevices ?? []) {
        const s = score(r.label, r.bus, r.interface, r.rdma);
        if (s) hits.push({ kind: 'pcie', id: r.component, title: `${r.label} ${r.bus}${r.interface ? ` ${r.interface}` : ''}`, next: 'nvl72_pcie_devices', score: s });
      }
      hits.sort((a, b) => b.score - a.score);
      return ok({ results: hits.slice(0, limit).map(({ score: _s, ...h }) => h), truncated: hits.length > limit });
    },
  );

  server.registerTool(
    'nvl72_get_component',
    {
      title: 'Get one part',
      description:
        'Returns everything the dataset holds about one part of the rack: what it is and does, how many per parent and per rack, its parent and the parts inside it, networks, specs, connections, PCIe rows, software that runs on it, BMC commands and procedures for it, safety notes, open questions, and every NVIDIA document section about it. Each fact has its source; "assumed": true marks a reading the documents do not state. Use nvl72_search first if you do not know the id.',
      inputSchema: z.object({ component: z.enum(COMPONENT_IDS).describe('Part id, e.g. "rubin-gpu" or "compute-tray". The schema lists them all.') }).strict(),
      outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        description: z.string(),
        function: z.string(),
        countPerParent: z.number().nullable(),
        totalPerRack: z.number().nullable(),
        parent: z.object({ id: z.string(), name: z.string() }).nullable(),
        children: z.array(z.object({ id: z.string(), name: z.string(), count: z.number().nullable() })),
        networks: z.array(z.string()),
        specs: z.array(SpecZ),
        connections: z.array(ConnZ),
        pcieDevices: z.array(PcieZ),
        software: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), source: SourceZ, note: z.string().optional() })),
        commands: z.array(CommandSummaryZ),
        procedures: z.array(z.object({ id: z.string(), title: z.string(), kind: z.string() })),
        safety: z.array(SafetyZ),
        openQuestions: z.array(QuestionZ),
        references: z.array(RefZ),
        ...ProvZ,
        explorer: z.string(),
      }),
      annotations: { title: 'Get one part', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ component }) => {
      const stop = limited();
      if (stop) return stop;
      const c = model.getComponent(component);
      if (!c) return fail(`Unknown part "${component}": nvl72_search finds part ids.`);
      const parent = c.parent ? model.getComponent(c.parent) : undefined;
      return ok({
        id: c.id,
        name: c.name,
        type: c.type,
        description: c.description,
        function: c.function,
        countPerParent: c.count,
        totalPerRack: model.totalPerRack(c.id),
        parent: parent ? { id: parent.id, name: parent.name } : null,
        children: model.childrenOf(c.id).map((k) => ({ id: k.id, name: k.name, count: k.count })),
        networks: c.networks,
        specs: specOut(c),
        connections: model.connectionsOf(c.id),
        pcieDevices: (topology.pcieDevices ?? []).filter((r) => r.component === c.id).map(({ assumed: _a, note: _n, ...r }) => r),
        software: (topology.software ?? []).filter((s) => s.runsOn.includes(c.id)).map(({ id, name, description, source, note }) => ({ id, name, description, source, note })),
        commands: (topology.commands ?? []).filter((x) => x.appliesTo.includes(c.id)).map(({ id, title, group }) => ({ id, title, group })),
        procedures: (topology.procedures ?? []).filter((p) => p.component === c.id).map(({ id, title, kind }) => ({ id, title, kind })),
        safety: (topology.safety ?? []).filter((s) => s.components.includes(c.id)).map(({ id, title, text, source }) => ({ id, title, text, source })),
        openQuestions: (topology.openQuestions ?? []).filter((q) => q.components.includes(c.id)),
        references: c.references,
        source: c.source,
        assumed: c.assumed,
        note: c.note,
        explorer: c.id === 'rack' ? SITE : explorerLink({ select: model.pathForComponent(c.id) }),
      });
    },
  );

  server.registerTool(
    'nvl72_get_network',
    {
      title: 'Get one network',
      description:
        'Returns one of the rack\'s seven networks (for example computenet or ipminet): what it is for, its fabric (InfiniBand or Ethernet, or null when the documents do not say), and every connection on it with the port and source. Connections with "alternative": true are a conflicting reading kept from NVIDIA\'s documents, not fact. Use nvl72_overview to list the networks.',
      inputSchema: z.object({ network: z.enum(NETWORK_IDS).describe('Network id, e.g. "computenet".') }).strict(),
      outputSchema: z.object({
        id: z.string(),
        number: z.number(),
        name: z.string(),
        description: z.string(),
        fabric: z.string().nullable(),
        ...ProvZ,
        connections: z.array(ConnZ.extend({ fromName: z.string() })),
        explorer: z.string(),
      }),
      annotations: { title: 'Get one network', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ network }) => {
      const stop = limited();
      if (stop) return stop;
      const n = model.getNetwork(network);
      if (!n) return fail(`Unknown network "${network}": nvl72_overview lists the networks.`);
      return ok({
        ...n,
        connections: topology.connections
          .filter((c) => c.network === n.id)
          .map((c) => ({ ...c, fromName: model.getComponent(c.from)?.name ?? c.from })),
        explorer: explorerLink({ net: n.id }),
      });
    },
  );

  server.registerTool(
    'nvl72_rack_layout',
    {
      title: 'Positions in the rack',
      description:
        'Lists the units in the rack from top to bottom with NVIDIA\'s numbering (power shelves are numbered from the bottom up), the position of each from the top edge in rack units, and its height. Optionally only one unit type. Use it for "where is compute tray 7" questions; use nvl72_get_component for what a unit contains.',
      inputSchema: z
        .object({ unit: z.enum(RACK_UNIT_IDS).optional().describe('Only this unit type, e.g. "compute-tray". Leave out for all.') })
        .strict(),
      outputSchema: z.object({
        totalRU: z.number(),
        units: z.array(z.object({ key: z.string(), component: z.string(), name: z.string(), number: z.number(), topRU: z.number(), heightRU: z.number(), explorer: z.string() })),
        source: SourceZ,
        numberingNote: z.string().optional(),
      }),
      annotations: { title: 'Positions in the rack', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ unit }) => {
      const stop = limited();
      if (stop) return stop;
      const units = model.rackUnits
        .filter((u) => !unit || u.componentId === unit)
        .map((u) => ({
          key: u.key,
          component: u.componentId,
          name: `${model.getComponent(u.componentId)!.name} ${u.index}`,
          number: u.index,
          topRU: u.topRU,
          heightRU: u.heightRU,
          explorer: explorerLink({ select: u.key }),
        }));
      return ok({ totalRU: model.totalRU, units, source: topology.rackLayout.source, numberingNote: topology.rackLayout.numbering?.note });
    },
  );

  server.registerTool(
    'nvl72_get_procedure',
    {
      title: 'Get a procedure',
      description:
        'Returns one service procedure (replacing a customer-replaceable unit, from the Service Manual) or operation (bring-up, reboots, health check, from the User Guide), step by step, with each step\'s source, any command quoted verbatim from the guide, and the safety notes that apply. Leave out the id to list all procedures with their titles. It only describes the steps; it runs nothing.',
      inputSchema: z
        .object({ procedure: z.enum(PROCEDURE_IDS).optional().describe('Procedure id, e.g. "psu". Leave out to list them.') })
        .strict(),
      outputSchema: z.object({
        procedures: z.array(z.object({ id: z.string(), title: z.string(), kind: z.string(), component: z.string() })).optional(),
        procedure: z
          .object({
            id: z.string(),
            title: z.string(),
            kind: z.string(),
            component: z.string(),
            steps: z.array(z.object({ number: z.number(), text: z.string(), command: z.string().optional(), source: SourceZ })),
            safety: z.array(SafetyZ),
            explorer: z.string(),
          })
          .optional(),
      }),
      annotations: { title: 'Get a procedure', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ procedure }) => {
      const stop = limited();
      if (stop) return stop;
      const all = topology.procedures ?? [];
      if (!procedure) return ok({ procedures: all.map(({ id, title, kind, component }) => ({ id, title, kind, component })) });
      const p = all.find((x) => x.id === procedure);
      if (!p) return fail(`Unknown procedure "${procedure}": call nvl72_get_procedure with no id to list them.`);
      return ok({
        procedure: {
          id: p.id,
          title: p.title,
          kind: p.kind,
          component: p.component,
          steps: p.steps.map((s, i) => ({ number: i + 1, text: s.text, command: s.command, source: s.source })),
          safety: (topology.safety ?? []).filter((s) => s.procedures.includes(p.id)).map(({ id, title, text, source }) => ({ id, title, text, source })),
          explorer: explorerLink({ proc: p.id }),
        },
      });
    },
  );

  server.registerTool(
    'nvl72_get_command',
    {
      title: 'Get a BMC command',
      description:
        'Returns one Redfish or IPMI command from section 6.4.1 of NVIDIA\'s guide, character for character, with its purpose, the parts it applies to and the guide\'s usage notes (set ${bmcip} first; the credentials shown are examples). Leave out the id to list all 30 commands by group. It only returns text; it never contacts a BMC.',
      inputSchema: z
        .object({ command: z.enum(COMMAND_IDS).optional().describe('Command id, e.g. "power-cycle-host". Leave out to list them.') })
        .strict(),
      outputSchema: z.object({
        commands: z.array(CommandSummaryZ.extend({ appliesTo: z.array(z.string()) })).optional(),
        command: z
          .object({
            id: z.string(),
            title: z.string(),
            group: z.string(),
            purpose: z.string(),
            command: z.string(),
            appliesTo: z.array(z.string()),
            note: z.string().optional(),
            source: SourceZ,
          })
          .optional(),
        usage: z.string().optional(),
        factoryReset: z.string().optional(),
      }),
      annotations: { title: 'Get a BMC command', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ command }) => {
      const stop = limited();
      if (stop) return stop;
      const all = topology.commands ?? [];
      const notes = topology.commandNotes;
      if (!command) return ok({ commands: all.map(({ id, title, group, appliesTo }) => ({ id, title, group, appliesTo })), usage: notes?.usage });
      const c = all.find((x) => x.id === command);
      if (!c) return fail(`Unknown command "${command}": call nvl72_get_command with no id to list them.`);
      return ok({ command: c, usage: notes?.usage, factoryReset: c.id.startsWith('reset-') ? notes?.factoryReset : undefined });
    },
  );

  server.registerTool(
    'nvl72_pcie_devices',
    {
      title: 'PCIe devices and interface names',
      description:
        'Returns rows of Table 2.4 of NVIDIA\'s guide as written: each network device\'s label, PCIe bus address, Linux interface name and RDMA device, with the part it belongs to. Optionally only the rows of one part. Use it to map a bus address or interface such as enP1p3s0f0np0 to a physical port.',
      inputSchema: z
        .object({ component: z.enum(PCIE_COMPONENT_IDS).optional().describe('Only rows for this part, e.g. "ct-port-cx9-osfp". Leave out for all.') })
        .strict(),
      outputSchema: z.object({ rows: z.array(PcieZ) }),
      annotations: { title: 'PCIe devices and interface names', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ component }) => {
      const stop = limited();
      if (stop) return stop;
      const rows = (topology.pcieDevices ?? []).filter((r) => !component || r.component === component).map(({ assumed: _a, note: _n, ...r }) => r);
      return ok({ rows });
    },
  );

  server.registerTool(
    'nvl72_open_questions',
    {
      title: 'Conflicts and gaps in NVIDIA\'s documents',
      description:
        'Lists where NVIDIA\'s documents contradict each other (conflict) or leave something out (gap), with the parts involved and a link to the full write-up. The dataset keeps the table\'s value in a conflict and leaves gaps empty rather than guessing. Use it before stating a count or position that a question depends on.',
      inputSchema: z
        .object({ kind: z.enum(['conflict', 'gap', 'all']).default('all').describe('"conflict", "gap" or "all".') })
        .strict(),
      outputSchema: z.object({ questions: z.array(QuestionZ) }),
      annotations: { title: 'Conflicts and gaps in NVIDIA\'s documents', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ kind }) => {
      const stop = limited();
      if (stop) return stop;
      return ok({ questions: (topology.openQuestions ?? []).filter((q) => kind === 'all' || q.kind === kind) });
    },
  );

  return server;
}


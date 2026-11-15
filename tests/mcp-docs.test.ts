// docs/mcp/tools.json and tools.md are generated from a real tools/list.
// `npm run mcp:docs` rewrites them; this test fails when they go stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { expect, it } from 'vitest';
import { createServer } from '../mcp/server';

type Prop = { type?: string; enum?: string[]; description?: string; default?: unknown; minimum?: number; maximum?: number; maxLength?: number };

function render(tools: { name: string; title?: string; description?: string; inputSchema: { properties?: Record<string, Prop>; required?: string[] } }[]) {
  const out = [
    '# MCP tools',
    '',
    'Generated from `tools/list` by `npm run mcp:docs`; do not edit by hand. Every tool is read-only.',
    '',
  ];
  for (const t of tools) {
    out.push(`## \`${t.name}\`: ${t.title ?? ''}`, '', t.description ?? '', '');
    const props = Object.entries(t.inputSchema.properties ?? {});
    if (props.length === 0) {
      out.push('No arguments.', '');
      continue;
    }
    out.push('| Argument | Type | Required | Description |', '| --- | --- | --- | --- |');
    for (const [name, p] of props) {
      let type = p.type ?? '';
      if (p.enum) type = p.enum.length > 6 ? `one of ${p.enum.length} ids (see tools.json)` : p.enum.map((e) => `\`${e}\``).join(', ');
      if (p.minimum !== undefined || p.maximum !== undefined) type += ` ${p.minimum ?? ''}..${p.maximum ?? ''}`;
      if (p.maxLength !== undefined) type += `, up to ${p.maxLength} chars`;
      const req = t.inputSchema.required?.includes(name) ? 'yes' : `no${p.default !== undefined ? ` (default ${JSON.stringify(p.default)})` : ''}`;
      out.push(`| \`${name}\` | ${type} | ${req} | ${p.description ?? ''} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

it('docs/mcp/tools.* match the server', async () => {
  const h = createMcpHandler(() => createServer());
  const client = new Client({ name: 'docs', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://docs.local/mcp'), { fetch: (u, i) => h.fetch(new Request(u, i)) }));
  const { tools } = await client.listTools();
  await client.close();
  const json = `${JSON.stringify({ tools }, null, 2)}\n`;
  const md = render(tools as never);
  if (process.env.MCP_DOCS_WRITE) {
    writeFileSync('docs/mcp/tools.json', json);
    writeFileSync('docs/mcp/tools.md', md);
  }
  expect(readFileSync('docs/mcp/tools.json', 'utf8'), 'run npm run mcp:docs').toBe(json);
  expect(readFileSync('docs/mcp/tools.md', 'utf8'), 'run npm run mcp:docs').toBe(md);
});

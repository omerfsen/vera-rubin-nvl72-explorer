# MCP standards: what this server meets

Checked on 2026-11-15 against MCP spec 2026-07-28, with the official
TypeScript SDK v2 (`@modelcontextprotocol/server` 2.4.0).

| Requirement | Level | Status | Proof |
| --- | --- | --- | --- |
| `server/discover` answers with supported versions, capabilities, identity | MUST | Yes | `scripts/mcp-wire.mjs`, live check |
| `resultType` on every result | MUST | Yes (SDK) | `scripts/mcp-wire.mjs` |
| `ttlMs` and `cacheScope` on `tools/list` | MUST | Yes: 3,600,000 ms, public | `scripts/mcp-wire.mjs` |
| `serverInfo` in each result's `_meta` | SHOULD | Yes (SDK) | `scripts/mcp-wire.mjs` |
| Capabilities stated honestly (`tools.listChanged: false`) | SHOULD | Yes; the SDK says `true` unless set | `scripts/mcp-wire.mjs` |
| stdout holds only MCP messages; logs on stderr | MUST | Yes | `scripts/mcp-wire.mjs` parses every stdout line as JSON |
| Exit when stdin closes | SHOULD | Yes | `scripts/mcp-wire.mjs` |
| Deterministic tool order | SHOULD | Yes | `tests/mcp.test.ts` |
| Bad input is an `isError` result; unknown tool is a JSON-RPC error | MUST | Yes | `tests/mcp.test.ts`, `scripts/mcp-wire.mjs` |
| Structured results also as a text block | SHOULD | Yes | `tests/mcp.test.ts` |
| Tool names unique, within 64 characters, service prefix | SHOULD | Yes: `nvl72_*` | `tests/mcp.test.ts` |
| `title`, `description`, `inputSchema` with `additionalProperties: false`, `outputSchema`, every argument described | SHOULD | Yes | `tests/mcp.test.ts` |
| Annotations: all four hints | SHOULD | Yes, all read-only | `tests/mcp.test.ts` |
| Validate inputs, rate limit tool calls, sanitize outputs | MUST | Yes; see `security.md` | `tests/mcp.test.ts` |
| HTTP: validate Origin; Host check against DNS rebinding | MUST / SHOULD | Yes | `tests/mcp.test.ts`, live 403 |
| HTTP: `MCP-Protocol-Version`, `Mcp-Method` headers checked | MUST | Yes (SDK) | Live: a request without them gets 400 |
| No Logging, Roots or Sampling (deprecated) | - | None used | `server/discover` capabilities |
| Docs generated from `tools/list`, with a drift test | House rule | Yes | `tests/mcp-docs.test.ts` |
| `server.json` valid, settings tested against code | House rule | Yes | `tests/mcp-server-json.test.ts` |

## Gaps

- **Authentication:** none, on purpose. See "Transport and authentication"
  in `security.md` for why that holds for this server only.
- **Rate limit across instances:** per Vercel instance only (see
  `security.md`).
- **Registry and graders:** not yet published to the MCP Registry, Glama or
  M8ven; `server.json` and `glama.json` are ready.
- **Conformance suite:** not run yet; it needs an HTTP URL, which now exists.

## Re-check when

- a new spec revision appears at https://modelcontextprotocol.io/specification/latest;
- the SDK has a new minor version: re-run `npm test`, `npm run mcp:e2e` and
  `node scripts/mcp-live.mjs`.

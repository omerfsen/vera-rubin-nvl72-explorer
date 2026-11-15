# MCP test results

Real output, recorded on 2026-11-15 against production `84c893c`.

| File | What it is | How to re-run |
| --- | --- | --- |
| `live-check.txt` | The official SDK client connecting to `https://verarubin-nvl72.faruk.net/mcp` and asking five questions, plus one hostile id | `node scripts/mcp-live.mjs` |
| `wire-stdio.txt` | Raw JSON-RPC against the built stdio bundle | `npm run mcp:e2e` |

Live HTTP checks done by hand with `curl`:

| Check | Result |
| --- | --- |
| `GET /mcp` | 405, "takes POST only" |
| `server/discover` without `MCP-Protocol-Version` header | 400 from the SDK (header required on HTTP) |
| `server/discover` with the headers | `resultType: complete`, `supportedVersions: ["2026-07-28"]`, `tools.listChanged: false` |
| `tools/list` | 9 tools, `ttlMs: 3600000`, `cacheScope: public` |
| `Origin: https://evil.example` | 403 |
| 70 sequential POSTs from one IP | No 429: the bucket refills 2/s while they run |
| 150 parallel POSTs from one IP | 123 answered, 27 got 429 |

What this does not prove: the rate limit across Vercel instances (it is per
instance), behaviour under real load, and how well a model picks the tools
(see `../evaluations.md`).

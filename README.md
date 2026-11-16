# Vera Rubin NVL72 Explorer

An interactive 3D explorer of the NVIDIA DGX Vera Rubin NVL72 rack, for
learning. Click a unit in the rack to see what it is, what it does, how many
there are, which networks it sits on, and where in the NVIDIA documentation
that comes from.

It shows the **Vera Rubin** generation (Vera CPU + Rubin GPU, NVLink 6), not
the earlier Grace Blackwell GB200/GB300 NVL72 racks.

It is a learning tool, not a digital twin. It has no telemetry and no
performance simulation.

Live: https://verarubin-nvl72.faruk.net

> **Unofficial.** This project is not affiliated with, endorsed by, or
> sponsored by NVIDIA Corporation. NVIDIA, DGX, Vera, Rubin, NVLink, NVSwitch,
> ConnectX and BlueField are trademarks or registered trademarks of NVIDIA
> Corporation. All 3D geometry is original and only illustrative. No NVIDIA
> images or logos are included.

## Status

Milestone 1 of 4:

- [x] **M1**: rack view with clickable trays, switch trays, power shelves and
  ToR switches; side panel; breadcrumb; search; list view; URL state
- [x] **M2**: compute tray interior, every part clickable
- [x] **M3**: switch tray, power shelf and rear view (cartridges, manifolds, bus bar)
- [x] **M4**: network overlay for the seven networks

## Source of truth

All data comes from two NVIDIA documents:

- **NVIDIA DGX VR NVL72 User Guide** (5 Nov 2026):
  https://docs.nvidia.com/dgx/dgxvr-user-guide/ (HTML, the same content as
  the [PDF](https://docs.nvidia.com/dgx/dgxvr-user-guide/dgxvr-user-guide.pdf))
- **NVIDIA DGX VR NVL72 Service Manual** (7 Oct 2026):
  https://docs.nvidia.com/dgx/dgxvr-service-manual/ (HTML and
  [PDF](https://docs.nvidia.com/dgx/dgxvr-service-manual/dgxvr-service-manual.pdf)),
  for customer-replaceable units and power shelf numbering

Every fact in [`data/nvl72-topology.json`](data/nvl72-topology.json) carries
a source (URL and section). Anything the guide does not state is either left
out or marked `assumed` with a note. The app shows those as **assumed**
badges. Gaps and contradictions in the guide are listed in
[`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md). The format is described in
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Run locally

Needs Node.js 26 (see `.nvmrc`; CI and Vercel use the same major).

```bash
npm ci
npm run dev          # http://localhost:5173/
npm test             # schema, data integrity, model, URL and UI tests
npm run typecheck
npm run build        # static site in dist/
npm run e2e          # real browser tests (Playwright, Chromium with software WebGL)
npm run preview      # serve dist/ locally
```

## Serving from a sub-path

The build is fully static. To serve it from a sub-path of another site, set
`VITE_BASE_PATH` at build time:

```bash
VITE_BASE_PATH=/vera-rubin-nvl72-explorer/ npm run build
```

Then copy `dist/` to that path. It defaults to `/`. To try a sub-path build
locally, set the same variable for preview and open the sub-path:

```bash
VITE_BASE_PATH=/vera-rubin-nvl72-explorer/ npm run preview
# http://localhost:4173/vera-rubin-nvl72-explorer/
```

See [`.env.example`](.env.example).

## Deployment

The site is deployed on Vercel from `main` (production) and from every pull
request (preview), using [`vercel.json`](vercel.json). Production is served at
https://verarubin-nvl72.faruk.net. https://vr-nvl72.faruk.net redirects there.

## For operators

- **On the host.** Every part that appears in the guide's Table 2.4 shows its
  PCIe bus, Linux interface and RDMA device, and search understands them:
  type `mlx5_4`, `enP12p3s0f0np0` or `0002:81:00.0` to land on the exact OSFP
  cage, GPU or drive. The eight OSFP cages carry NVIDIA's labels, C1/C1_1 to
  C7/C7_2.
- **Service procedures.** The five customer-replaceable units (PSU, power
  shelf management module, E1.S cache drive, compute tray battery, switch
  tray battery) have step-by-step walkthroughs from the service manual. Each
  step highlights the part it is about on an example unit and cites its
  section. Always follow the service manual itself and its safety notes.
- **Sources page.** Lists both documents, every conflict between NVIDIA's
  figures and tables, and every assumed fact with its reason, generated from
  the data.
- **The dataset.** The site publishes `data/nvl72-topology.json` and its schema
  next to the app, for reuse in other tools.
- **Share and embed.** Every view has a link; the panel copies it, or an
  `<iframe>` snippet. `?embed=1` hides the header, network bar and footer.
- **Record a video.** Record in the top bar captures the tab and saves it on
  your computer as WebM and MP4 (WebM only where the browser cannot encode
  MP4, such as Firefox). Tick Voice to add your voice from the microphone.
  Nothing is uploaded. Build with
  `VITE_SHOW_RECORDER=false` to remove the button.

## Official figures (off by default)

`SHOW_OFFICIAL_FIGURES` (`src/config/flags.ts`) adds the guide's figures to
the side panel, hot-linked from `docs.nvidia.com`. The images are never
copied into this repository or the build. It is off until NVIDIA grants
permission. To turn it on for a build:

```bash
VITE_SHOW_OFFICIAL_FIGURES=true npm run build
```

On Vercel, add the environment variable `VITE_SHOW_OFFICIAL_FIGURES` with the
value `true` for Production and redeploy. Nothing else changes: each part
already names its figure, the site's Content-Security-Policy already allows
images from `docs.nvidia.com`, and the figures load with no referrer.

## Using it

- Click or tap a unit to select it. Drag to rotate, scroll or pinch to zoom.
- Click a selected compute tray again (or double-click it, press Enter, or use
  **Open** in the panel) to open it and click any part inside: GPUs, CPUs,
  SOCAMM, ConnectX-9, BlueField-4, drives, BMC/HMC, ports and more. The
  interior layout is schematic (marked *assumed*): it follows the arrangement
  in NVIDIA's top and front views but is not traced from them or to scale.
- Switch trays, power shelves and ToR switches open the same way. Power shelf
  PSUs are numbered 1 to 6 as in NVIDIA's service manual and show their power
  and fault LEDs; the ToR switch shows the 48 RJ45 ports, 4 larger cages and 3
  side ports of NVIDIA's Fig. 9. Every unit's front in the rack view is drawn
  from the same layouts.
- Select a ToR switch (or highlight ipminet) to see the 45 BMC links from
  every compute and switch tray to the ToR pair. The routing and the split
  between the two switches are not documented, so the lines are schematic.
- **Rear** shows the back of the rack as in NVIDIA's rear view (Fig. 2): the
  NVLink cable cartridges, the two liquid cooling manifolds with their FD83
  hose connectors, the bus bar, their supports, the rear bezel and seismic
  bracing. Every unit's back carries its own connectors (NVLink connectors,
  water inlet and outlet, bus bar or power connector; AC whips and the 54 V DC
  output on power shelves), each wired to the part it plugs into. Select a
  compute tray to see its NVLinks reach all 9 switch trays through the
  cartridge, or a switch tray to see it reach all 18 compute trays.
- **Networks** (the bar under the breadcrumb) highlights one of the seven
  networks: in the rack, the units with a port on it; inside a tray, the exact
  ports. The panel lists what is on it, with counts per rack. The BlueField-4
  left port shows in orange for storagenet, because the guide's table and its
  port figure disagree (see `docs/OPEN_QUESTIONS.md`). externalnet,
  internalnet and failovernet reach no port in the rack.
- Inside a tray, three layers can be switched on and off, like an anatomy
  chart: **Structure** (the bones: tray shell), **Parts** (the muscles) and
  **Connections** (the veins: PCIe, C2C, Clink, NVLink, coolant and power,
  from NVIDIA's block diagram and PCIe tables). Selecting a part highlights its
  own connections. Dashed lines are inferred and marked *assumed* in the
  panel.
- With the 3D view focused, Up/Down step through the rack (or through the
  parts of an open tray) and Enter opens a compute tray. `Esc` goes up one
  level and closes an open tray.
- **List view** shows the rack as a plain list. The app also uses it on its
  own when the browser has no WebGL.
- The URL holds the selection and the list pane (e.g.
  `?select=compute-tray.7&list=1`), so you can share a link to any unit.
- Power shelves are numbered 1 to 4 from the bottom up, as in NVIDIA's service
  manual. Compute and switch trays are numbered from the top down; NVIDIA does
  not number them by rack position, so that numbering is marked *assumed*.

## Ask questions with MCP

The same data is served as a read-only [MCP](https://modelcontextprotocol.io) server, so an AI assistant can answer questions about the rack and cite NVIDIA's documents. The public endpoint needs no login and is rate limited:

```
https://verarubin-nvl72.faruk.net/mcp
```

### Add it to a client

- **Claude Code:** `claude mcp add --transport http vr-nvl72 https://verarubin-nvl72.faruk.net/mcp`
- **Claude Desktop or claude.ai:** Settings, Connectors, Add custom connector, then paste the URL.
- **VS Code** (`.vscode/mcp.json`):
  ```json
  { "servers": { "vr-nvl72": { "type": "http", "url": "https://verarubin-nvl72.faruk.net/mcp" } } }
  ```
- **Cursor** (`~/.cursor/mcp.json`): `{ "mcpServers": { "vr-nvl72": { "url": "https://verarubin-nvl72.faruk.net/mcp" } } }`
- **Offline, over stdio:** `npm ci && npm run mcp:build`, then add `node /path/to/repo/mcp/dist/vr-nvl72-mcp.mjs` as a stdio server (for Claude Code: `claude mcp add vr-nvl72 -- node /path/to/repo/mcp/dist/vr-nvl72-mcp.mjs`).

### Check that it works

1. In Claude Code, run `claude mcp list`: `vr-nvl72` should show as connected. In other clients, the server's ten `nvl72_*` tools should appear in the tool list.
2. Ask: "How many GPUs are in a Vera Rubin NVL72 rack?" The answer should be 72 (18 compute trays with 4 GPUs each), from `nvl72_overview` and `nvl72_get_component`, citing section 1.2 of the User Guide.
3. Ask: "Which physical port is enP1p3s0f0np0?" It should find C1/C1_1 on bus `0001:03:00.0` with `nvl72_search`.
4. Ask: "Where is compute tray 7 in the rack?" `nvl72_rack_layout` places it 14 RU from the top.
5. Ask: "Show me the Redfish command to power-cycle a host." `nvl72_get_command` returns it exactly as the guide prints it.

Without an AI client, `node scripts/mcp-live.mjs` connects with the official SDK client and runs the same checks. The tools are listed in [docs/mcp/tools.md](docs/mcp/tools.md); the security model is in [docs/mcp/security.md](docs/mcp/security.md).

| Standard (spec 2026-07-28) | Status |
| --- | --- |
| `server/discover`, `resultType`, `serverInfo` in `_meta` | Yes, proved by `scripts/mcp-wire.mjs` |
| `ttlMs` and `cacheScope` on `tools/list` | Yes: one hour, public |
| Read-only tools with all four annotation hints, `outputSchema`, structured and text results | Yes, tested |
| Arguments are enums or bounded values, unknown fields refused | Yes, tested with hostile values |
| Rate limits on requests and tool calls | Yes, per IP; per instance on Vercel (see security) |
| Host and Origin checks, body cap, stateless | Yes, tested |
| Authentication | None: public data, nothing to protect or change (see security) |

## Contributing

See [AGENTS.md](AGENTS.md) for the data rules, the checks to run and the commit style.

## Project layout

```
data/              topology JSON + JSON Schema (the source of truth)
docs/              data model, open questions, MCP docs (docs/mcp/)
mcp/               MCP server: tools (server.ts), stdio and HTTP entries
api/               Vercel function that serves /mcp
src/data/          types and model helpers (instances, paths, totals)
src/scenes/        3D scenes: rack front and rear, tray, shelf and ToR interiors
src/components/    side panel, breadcrumb, search, list view
src/state/         Zustand store and URL sync
src/config/        feature flags
tests/             Vitest tests
```

Built with Vite, React, TypeScript, Three.js (React Three Fiber and Drei),
Zustand and Vitest. Dependency versions are pinned and the lockfile is
committed.

## Author

Omer Sen

## Support

If this explorer helped you, you can buy me a coffee:
https://buymeacoffee.com/omerfsen

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-omerfsen-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/omerfsen)

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE); anyone redistributing this project must keep the NOTICE file.

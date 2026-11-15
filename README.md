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
- [ ] **M2**: compute tray interior, every part clickable
- [ ] **M3**: switch tray, power shelf and rear view (cartridges, manifolds, bus bar)
- [ ] **M4**: network overlay for the seven networks

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

## Official figures (off by default)

`SHOW_OFFICIAL_FIGURES` (`src/config/flags.ts`) adds the guide's figures to
the side panel, hot-linked from `docs.nvidia.com`. The images are never
copied into this repository or the build. It is off until NVIDIA grants
permission. To turn it on for a build:

```bash
VITE_SHOW_OFFICIAL_FIGURES=true npm run build
```

## Using it

- Click or tap a unit to select it. Drag to rotate, scroll or pinch to zoom.
- Up/Down arrow keys (or `j`/`k`) step through the rack. `Esc` goes up one
  level. `/` jumps to search.
- **List view** shows the rack as a plain list. The app also uses it on its
  own when the browser has no WebGL.
- The URL holds the selection and the list pane (e.g.
  `?select=compute-tray.7&list=1`), so you can share a link to any unit.
- Power shelves are numbered 1 to 4 from the bottom up, as in NVIDIA's service
  manual. Compute and switch trays are numbered from the top down; NVIDIA does
  not number them by rack position, so that numbering is marked *assumed*.

## Project layout

```
data/              topology JSON + JSON Schema (the source of truth)
docs/              data model, open questions
src/data/          types and model helpers (instances, paths, totals)
src/scenes/        3D scenes (rack now; trays, shelves and rear later)
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

## License

Apache License 2.0. See [LICENSE](LICENSE).

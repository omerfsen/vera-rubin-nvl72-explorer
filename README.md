# Vera Rubin NVL72 Explorer

An interactive 3D explorer of the NVIDIA DGX Vera Rubin NVL72 rack, for
learning. Click a unit in the rack to see what it is, what it does, how many
there are, which networks it sits on, and where in the NVIDIA documentation
that comes from.

It is a learning tool, not a digital twin. It has no telemetry and no
performance simulation.

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

All data comes from the **NVIDIA DGX VR NVL72 User Guide** (5 Nov 2026):

- https://docs.nvidia.com/dgx/dgxvr-user-guide/dgxvr-user-guide.pdf
- https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html
- https://docs.nvidia.com/dgx/dgxvr-user-guide/networking.html

Every fact in [`data/nvl72-topology.json`](data/nvl72-topology.json) carries
a source (URL and section). Anything the guide does not state is either left
out or marked `assumed` with a note. The app shows those as **assumed**
badges. Gaps and contradictions in the guide are listed in
[`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md). The format is described in
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Run locally

Needs Node.js 22 or newer (CI uses 24, see `.nvmrc`).

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

Then copy `dist/` to that path. It defaults to `/`. See
[`.env.example`](.env.example).

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
- The URL holds the selection (e.g. `?select=compute-tray.7`), so you can
  share a link to any unit.

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

To be confirmed.

# Data model

All facts live in [`data/nvl72-topology.json`](../data/nvl72-topology.json).
They are checked against
[`data/nvl72-topology.schema.json`](../data/nvl72-topology.schema.json)
(JSON Schema 2020-12) in `tests/schema.test.ts`, and for references between
them in `tests/integrity.test.ts`. The 3D scene, the list view, search and the
side panel are all generated from this file.

## Rules

- Every component, network, connection, rack layout entry and height has a
  `source`: `{ url, section, figure? }`. The URL must point into
  `https://docs.nvidia.com/dgx/dgxvr-user-guide/`. A spec without its own
  `source` uses its component's source.
- If the guide does not state something, either leave it out, set it to
  `null` (for `count`), or set `"assumed": true`. An assumed item must have a
  `note`. The schema enforces this.
- `figure` names a file under the guide's `_images/` folder. It is only
  hot-linked, and only when `SHOW_OFFICIAL_FIGURES` is on.

## Top level

| Key | What it holds |
| --- | --- |
| `meta` | Title, the guide (title, date, URLs) and the date the data was taken. |
| `networks` | The seven networks from Section 2.2, numbered 1 to 7 as in the guide. |
| `components` | A tree of component *types* (not instances), rooted at `rack`. |
| `rackLayout` | The order of the front units, top to bottom, with heights and the numbering scheme. |
| `connections` | Ports to networks, BMCs to the ToR switches, NVLink, power and cooling paths. |

## Component

| Field | Meaning |
| --- | --- |
| `id` | Kebab-case id, unique. |
| `type` | One of `rack`, `compute-tray`, `switch-tray`, `power-shelf`, `tor-switch`, `cpu`, `gpu`, `nic`, `dpu`, `drive`, `switch-asic`, `psu`, `bmc`, `controller`, `port`, `cable-cartridge`, `manifold`, `bus-bar`. |
| `name` | Display name. |
| `count` | How many per *parent* instance. `null` if the guide does not say. The app multiplies along the parent chain for "per rack" totals. |
| `parent` | Parent component id. `null` only for `rack`. |
| `description` | What it is. |
| `function` | What it does. |
| `networks` | Network ids this component itself is on. Each one must be backed by a sourced connection. |
| `specs` | `{ label, value, unit?, source?, assumed?, note? }` list. |
| `source`, `assumed`, `note` | Provenance. |
| `rearSide` | `true` for parts at the rear of the rack (cartridges, manifolds, bus bar). |

## Rack layout and instances

`rackLayout.groups` is the stack from Fig. 1, top to bottom, for example
`{ "component": "compute-tray", "count": 10 }`. The app expands it into
numbered units (`compute-tray.1` to `compute-tray.18`), numbering each type
from the top down. The numbering is an assumption, recorded in
`rackLayout.numbering`.

## Selection paths and URLs

A selection is a path of component ids below the rack, each with an optional
instance number:

- `compute-tray.7`: compute tray 7
- `compute-tray.7/rubin-gpu`: the Rubin GPUs in compute tray 7
- `compute-tray.7/rubin-gpu.2`: GPU 2 in compute tray 7

The path goes in the URL as `?select=...`. The view goes in as `?view=...`
and is left out when it is the default (`rack`). Invalid paths fall back to
the rack.

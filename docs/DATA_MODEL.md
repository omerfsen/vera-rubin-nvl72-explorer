# Data model

All facts live in [`data/nvl72-topology.json`](../data/nvl72-topology.json).
They are checked against
[`data/nvl72-topology.schema.json`](../data/nvl72-topology.schema.json)
(JSON Schema 2020-12) in `tests/schema.test.ts`, and for references between
them in `tests/integrity.test.ts`. The 3D scene, the list view, search and the
side panel are all generated from this file.

## Rules

- Every component, network, connection, rack layout entry and height has a
  `source`: `{ url, section, figure? }`. The URL must be a page of the DGX VR
  NVL72 User Guide (`hardware`, `networking`, `storage`) or Service Manual,
  or one of their PDFs. A spec without its own `source` uses its component's
  source. Facts in `description` or `function` that the main source does not
  state are cited in `textSources`. A network's `fabric` is cited in
  `fabricSource`.
- If the guide does not state something, either leave it out, set it to
  `null` (for `count`), or set `"assumed": true`. An assumed item must have a
  `note`. The schema enforces this.
- `figure` must be one of the 13 user guide figures under the guide's
  `_images/` folder. It is only hot-linked, and only when
  `SHOW_OFFICIAL_FIGURES` is on. Service manual figures are cited by section
  only.
- When a figure and the text disagree, the data keeps the text and adds a
  `note`. The conflict is listed in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

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
| `type` | One of `rack`, `compute-tray`, `switch-tray`, `power-shelf`, `tor-switch`, `cpu`, `gpu`, `nic`, `dpu`, `drive`, `switch-asic`, `psu`, `bmc`, `controller`, `port`, `cable-cartridge`, `manifold`, `bus-bar`, `battery`. |
| `name` | Display name. |
| `count` | How many per *parent* instance. `null` if the guide does not say. The app multiplies along the parent chain for "per rack" totals. |
| `parent` | Parent component id. `null` only for `rack`. |
| `description` | What it is. |
| `function` | What it does. |
| `networks` | Network ids this component itself is on. Each one must be backed by a sourced connection. |
| `specs` | `{ label, value, unit?, source?, assumed?, note? }` list. |
| `source`, `assumed`, `note` | Provenance. |
| `textSources` | Extra sources for facts in `description` and `function`. |
| `rearSide` | `true` for parts at the rear of the rack (cartridges, manifolds, bus bar). |

## Rack layout and instances

`rackLayout.groups` is the stack from Fig. 1, top to bottom, for example
`{ "component": "compute-tray", "count": 10 }`. The app expands it into
numbered units (`compute-tray.1` to `compute-tray.18`). By default each type
is numbered from the top down, which is an assumption recorded in
`rackLayout.numbering`. `rackLayout.numbering.overrides` holds sourced
exceptions: power shelves are numbered from the bottom up, as in the service
manual.

## Tray interiors

`trayLayouts.<tray component id>` describes a schematic interior: a list of
`slots`, each placing one instance of a part inside the tray
(`{ component, index?, label?, face, x, z, y?, w, d, h }`). `face: "top"`
parts lie inside the tray (x and z run from -0.5 to 0.5 across width and
depth, +z is the front); `face: "front"` parts sit in the front panel (y from
0 at the bottom to 1 at the top). `label` holds NVIDIA's name for the
instance, such as `GPU0 (HPM_L GPU_0)`. Components with no stated count are
placed without an `index`. Parts that cannot be placed are listed in
`notPlaced` with a reason. The whole layout carries `assumed: true`: positions
follow the arrangement in NVIDIA's figures but are not measurements.

`links` are instance-level connections inside the tray, each with a `kind`
(`pcie`, `c2c`, `clink`, `nvlink`, `coolant`, `power`), `from` and `to` ends
(`{ component, index }` for a part, `{ point }` for a named spot in `points`,
such as the rear NVLink connectors), and their own provenance. Links read from
the block diagram are sourced to it; inferred links carry `assumed: true` and a
note, and are drawn dashed.

Tests require every part inside the tray to be placed or listed in
`notPlaced`, every instance number to be within its count, and every slot to
resolve to a selectable path.

## Selection paths and URLs

A selection is a path of component ids below the rack, each with an optional
instance number:

- `compute-tray.7`: compute tray 7
- `compute-tray.7/rubin-gpu`: the Rubin GPUs in compute tray 7
- `compute-tray.7/rubin-gpu.2`: GPU 2 in compute tray 7

The path goes in the URL as `?select=...` and the list pane as `list=1`. The
view goes in as `?view=...` (`tray` while a compute tray is open) and is left
out when it is the default (`rack`). `view=tray` without a selection inside a
numbered compute tray falls back to the rack.
Invalid paths fall back to the rack. Other query parameters are left exactly
as they were.

# Working on this repo

An unofficial, static 3D explorer of the NVIDIA DGX Vera Rubin NVL72 rack:
Vite, React, TypeScript, React Three Fiber, Drei, Zustand and Vitest. It is a
learning tool, not a digital twin: no telemetry, no performance simulation.
Read `README.md` for what it does and `docs/DATA_MODEL.md` for the data.

## Facts come only from NVIDIA's documents

- The only sources are the NVIDIA DGX VR NVL72 User Guide and Service Manual
  on docs.nvidia.com (`dgxvr-user-guide/`, `dgxvr-service-manual/`). The
  schema rejects any other URL.
- Every fact in `data/nvl72-topology.json` carries a `source` (URL with the
  section anchor, plus the section title). A spec without its own source uses
  its component's.
- If the documents do not say something, leave it out, use `count: null`, or
  mark it `"assumed": true` with a `note` saying why. Never fill a gap with a
  plausible guess.
- When a figure and a table disagree, keep the table's value, add a note on
  the item, and record the conflict in `openQuestions` (data) and
  `docs/OPEN_QUESTIONS.md`. Do not resolve it silently.
- Read the figures yourself before using them, and say "counted from Fig. N"
  for anything taken from a figure rather than the text.

## Where things live

| Path | What |
| --- | --- |
| `data/nvl72-topology.json` | All facts: components, networks, rack/tray/rear layouts, connections, Table 2.4, service procedures, open questions, per-component document references |
| `data/nvl72-topology.schema.json` | JSON Schema for it (draft 2020-12) |
| `data/display.json` | Colours, link names and rear styling only; no facts |
| `data/site.json` | Page title, tagline, trademark line and the author links |
| `src/data/` | Types and the model (paths, instances, totals, network members) |
| `src/scenes/` | 3D scenes: rack front and rear, tray interiors, shared rods and colours |
| `src/components/` | Side panel, search, breadcrumb, network bar, sources page, procedures |
| `src/state/` | Zustand store and URL state |
| `scripts/references.mjs` | Builds every component's `references` |
| `data/i18n/{en,tr,zh}.json` | Every UI string (`ui`) and the translated descriptive text (`content`); English is the source |
| `scripts/i18n-content.mjs` | Builds the `content` part of `en.json` from the data |
| `tests/` | Schema, integrity, facts, model, UI and scene tests |

The scene is generated from the data. Do not hard-code component IDs, counts
or facts in `src/`; add them to the data and read them from there.

## After editing the data

```bash
npm run data:refs   # rebuild components[].references
npm run i18n:en     # rebuild the content part of data/i18n/en.json
npm test            # schema, integrity and drift checks
npm run typecheck
npm run build
npm run e2e         # real browser tests; locally: PW_CHROMIUM_PATH=/usr/bin/chromium npm run e2e
```

`tests/references.test.ts` fails if `references` is out of date. `tests/i18n.test.ts` fails if `en.json` is out of date, or if
`tr.json` or `zh.json` lacks a key, has an extra one, or changes a `{placeholder}`;
add the Turkish and Chinese text for any new string. Do not put user-visible
English in `src/`: add a `ui` key and read it with `useI18n().t()`. Tray layouts
must place every part inside the tray or list it in `notPlaced` with a reason;
`tests/m3.test.ts` checks this for every layout.

## When NVIDIA updates its documents

`.github/workflows/doc-watch.yml` checks both PDFs every Monday against
`data/doc-fingerprints.json` (`npm run docs:check` by hand) and opens an issue
titled "NVIDIA documentation changed" when one differs. Read the new version,
update the data and its sources, then update the fingerprints.

## Licensing (strict)

- All 3D geometry is original. Do not trace or copy NVIDIA images, and do not
  add NVIDIA logos.
- NVIDIA figures may only appear as hot-links to docs.nvidia.com, behind
  `SHOW_OFFICIAL_FIGURES` (`VITE_SHOW_OFFICIAL_FIGURES`), which stays `false`
  until NVIDIA grants permission. CI fails if an image file is committed or
  bundled.
- Do not copy code or data from github.com/xuxiangyi-washu/vera-rubin-nvl72
  (it has no license).
- Keep the README statement: unofficial, not affiliated with or endorsed by
  NVIDIA, product names are NVIDIA trademarks.

## Code

- Repeated parts use `InstancedMesh`; the canvas uses `frameloop="demand"`, so
  call `invalidate()` after changing anything imperatively.
- Keep keyboard, touch, phone width and the no-WebGL list working.
- Dependencies are pinned to exact versions; the lockfile is committed.
- Node 26 (`.nvmrc`, `engines`).

## Commits and pull requests

- Conventional Commits, one short line, no body unless the change has
  genuinely unrelated parts: `feat(tray): open the switch tray`. No milestone
  tags, no lists of features in the subject.
- Work on a `dev/osen/<slug>` branch; open a PR against `main`. CI runs
  typecheck, tests and build; Vercel builds a preview for every PR and deploys
  `main` to https://verarubin-nvl72.faruk.net.
- PR descriptions: two or three plain sentences.

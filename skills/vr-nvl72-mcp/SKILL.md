---
name: vr-nvl72-mcp
license: Apache-2.0
description: Answer questions about the NVIDIA DGX Vera Rubin NVL72 rack through the vr-nvl72 MCP server - parts and counts, positions in the rack, networks and ports, PCIe bus and interface names, service procedures, BMC Redfish/IPMI commands, and where NVIDIA's documents conflict - citing the NVIDIA document section for each fact. Use when asked about Vera Rubin NVL72 hardware, its compute or switch trays, BlueField-4, ConnectX-9, NVLink switches, power shelves or how to service them.
---

# Answer Vera Rubin NVL72 questions with the vr-nvl72 MCP server

The tools below come from the `vr-nvl72` MCP server
(`https://verarubin-nvl72.faruk.net/mcp`). If they are not available, tell the
user and point them at
https://github.com/omerfsen/vera-rubin-nvl72-explorer#ask-questions-with-mcp.
Do not answer from memory instead: the point is that every fact is sourced.

## How to answer

1. Not sure of the id? Call `nvl72_search` with the user's words, then the
   `nvl72_get_*` tool its result names.
2. For the big picture (units, totals, networks) call `nvl72_overview`.
3. For one part, `nvl72_get_component`; for "where in the rack",
   `nvl72_rack_layout`; for a network, `nvl72_get_network`; for a bus address
   or interface name such as `enP1p3s0f0np0`, `nvl72_pcie_devices`.
4. For "how do I replace or reboot", `nvl72_get_procedure`; for a BMC command,
   `nvl72_get_command`. Both only return text; nothing runs.
5. Before stating a count or position, check `nvl72_open_questions`: some
   numbers conflict between NVIDIA's table and figures.

## Rules for the answer

- Cite the `source.section` (and link `source.url`) of each fact you use.
- Say so when a fact has `"assumed": true`, a connection has
  `"alternative": true`, or a count is `null` (the documents do not say).
- NVIDIA numbers GPUs and CPUs from 0 (GPU0 to GPU3); explorer URLs count from 1.
- Commands contain example credentials and `${bmcip}`; repeat the guide's
  usage note rather than suggesting real values.
- Offer the `explorer` link so the user can see the part in 3D.
- This is unofficial: not affiliated with or endorsed by NVIDIA.

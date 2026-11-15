# Evaluations

Questions a model should answer with the tools, each with one checkable
answer that takes at least one tool call. Run them in an MCP client with the
server added and compare. All read-only.

| # | Question | Answer | Tools |
| --- | --- | --- | --- |
| 1 | How many Rubin GPUs are in one rack? | 72 | `nvl72_overview` or `nvl72_get_component` |
| 2 | How many compute trays, and how many NVLink switch trays? | 18 and 9 | `nvl72_overview` |
| 3 | Which physical port has interface `enP1p3s0f0np0`? | C1/C1_1 on the ConnectX-9 OSFP ports, bus `0001:03:00.0` | `nvl72_search`, `nvl72_pcie_devices` |
| 4 | How far from the top of the rack does compute tray 7 start? | 14 RU | `nvl72_rack_layout` |
| 5 | In which order are power shelves numbered? | From the bottom up: shelf 1 is the lowest | `nvl72_rack_layout` |
| 6 | Which fabric does computenet use? | InfiniBand | `nvl72_get_network` |
| 7 | How many SOCAMM memory modules are in a rack? | 288 | `nvl72_get_component socamm` |
| 8 | What is the first step to replace a failed PSU? | Find the failed PSU by its amber LED | `nvl72_get_procedure psu` |
| 9 | What does the guide say the default BMC login is after a factory reset? | admin/admin, to be changed at first login | `nvl72_get_command reset-bmc-to-factory-defaults` |
| 10 | Do NVIDIA's documents agree on how many ConnectX-9 cards a compute tray has? | No: the table says 2, the block diagram draws 8; the data keeps 2 | `nvl72_open_questions` |

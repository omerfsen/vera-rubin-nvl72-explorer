# MCP tools

Generated from `tools/list` by `npm run mcp:docs`; do not edit by hand. Every tool is read-only.

## `nvl72_overview`: Rack overview

Summarises the whole DGX Vera Rubin NVL72 rack: the source documents and their dates, the units in the rack with how many of each, per-rack totals of the main parts (GPUs, CPUs, NICs, switch ASICs, PSUs), and the seven networks. Takes no arguments and changes nothing. Start here; use nvl72_get_component for one part, nvl72_rack_layout for positions in the rack.

No arguments.

## `nvl72_search`: Search the rack data

Finds parts, networks, procedures, BMC commands and PCIe rows whose name, id, description, label, bus address or interface name contain every word of the query (case-insensitive). Returns ids to pass to the nvl72_get_* tools, best matches first; it does not return the facts themselves. Use it when you do not know the exact id; use nvl72_get_component directly when you do.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string, up to 80 chars | yes | Words to look for, e.g. "bluefield port" or "0001:03:00.0". Up to 80 characters. |
| `limit` | integer 1..25 | no (default 10) | Most results to return, 1 to 25. |

## `nvl72_get_component`: Get one part

Returns everything the dataset holds about one part of the rack: what it is and does, how many per parent and per rack, its parent and the parts inside it, networks, specs, connections, PCIe rows, software that runs on it, BMC commands and procedures for it, safety notes, open questions, and every NVIDIA document section about it. Each fact has its source; "assumed": true marks a reading the documents do not state. Use nvl72_search first if you do not know the id.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `component` | one of 56 ids (see tools.json) | yes | Part id, e.g. "rubin-gpu" or "compute-tray". The schema lists them all. |

## `nvl72_get_network`: Get one network

Returns one of the rack's seven networks (for example computenet or ipminet): what it is for, its fabric (InfiniBand or Ethernet, or null when the documents do not say), and every connection on it with the port and source. Connections with "alternative": true are a conflicting reading kept from NVIDIA's documents, not fact. Use nvl72_overview to list the networks.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | one of 7 ids (see tools.json) | yes | Network id, e.g. "computenet". |

## `nvl72_rack_layout`: Positions in the rack

Lists the units in the rack from top to bottom with NVIDIA's numbering (power shelves are numbered from the bottom up), the position of each from the top edge in rack units, and its height. Optionally only one unit type. Use it for "where is compute tray 7" questions; use nvl72_get_component for what a unit contains.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `unit` | `tor-switch`, `power-shelf`, `compute-tray`, `switch-tray` | no | Only this unit type, e.g. "compute-tray". Leave out for all. |

## `nvl72_get_procedure`: Get a procedure

Returns one service procedure (replacing a customer-replaceable unit, from the Service Manual) or operation (bring-up, reboots, health check, from the User Guide), step by step, with each step's source, any command quoted verbatim from the guide, and the safety notes that apply. Leave out the id to list all procedures with their titles. It only describes the steps; it runs nothing.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `procedure` | one of 10 ids (see tools.json) | no | Procedure id, e.g. "psu". Leave out to list them. |

## `nvl72_get_command`: Get a BMC command

Returns one Redfish or IPMI command from section 6.4.1 of NVIDIA's guide, character for character, with its purpose, the parts it applies to and the guide's usage notes (set ${bmcip} first; the credentials shown are examples). Leave out the id to list all 30 commands by group. It only returns text; it never contacts a BMC.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | one of 30 ids (see tools.json) | no | Command id, e.g. "power-cycle-host". Leave out to list them. |

## `nvl72_pcie_devices`: PCIe devices and interface names

Returns rows of Table 2.4 of NVIDIA's guide as written: each network device's label, PCIe bus address, Linux interface name and RDMA device, with the part it belongs to. Optionally only the rows of one part. Use it to map a bus address or interface such as enP1p3s0f0np0 to a physical port.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `component` | one of 8 ids (see tools.json) | no | Only rows for this part, e.g. "ct-port-cx9-osfp". Leave out for all. |

## `nvl72_open_questions`: Conflicts and gaps in NVIDIA's documents

Lists where NVIDIA's documents contradict each other (conflict) or leave something out (gap), with the parts involved and a link to the full write-up. The dataset keeps the table's value in a conflict and leaves gaps empty rather than guessing. Use it before stating a count or position that a question depends on.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `kind` | `conflict`, `gap`, `all` | no (default "all") | "conflict", "gap" or "all". |

## `nvl72_glossary`: Glossary of terms and abbreviations

Returns terms and abbreviations (BMC, CRU, NVLink, TOR, ...) as NVIDIA's documents expand or define them, each with its document section. Optionally one term by id. Terms the documents do not define are not in the list.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | one of 23 ids (see tools.json) | no | Only this term, e.g. "bmc". Leave out for all. |

## `nvl72_changes`: What changed in the data

Lists the changes to this dataset, newest first: the day, the NVIDIA document it followed ("app-data" when it follows no single document), the document dates it reflects, the sections touched and a short summary. Also returns the date of each NVIDIA document the data is built from. Use it to say how current the data is.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `document` | `user-guide`, `service-manual`, `app-data` | no | Only changes that followed this document. Leave out for all. |

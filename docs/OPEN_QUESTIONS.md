# Open questions

Places where the NVIDIA DGX VR NVL72 User Guide (5 Nov 2026) is unclear,
contradicts itself, or says nothing. The data file records what the guide
says. Anything this project had to assume is marked `"assumed": true` with a
note.

## 1. Number of ConnectX-9 cards per compute tray

- Section 1.2, compute tray configuration table: "2 NVIDIA ConnectX-9 I/O cards
  for InfiniBand cluster interconnect and multi-rack clustering".
- Section 2.4, Network Interface Names, PCIe table (front view): eight
  ConnectX entries in four groups, `C1/C1_1`, `C1/C1_2`, `C3/C3_1`,
  `C3/C3_2`, `C5/C5_1`, `C5/C5_2`, `C7/C7_1`, `C7/C7_2`. Each has its own
  PCIe bus, interface and RDMA device.

The data file keeps `count: 2` from the configuration table and lists the
eight PCIe labels as a spec, with a note. It does not decide whether C1, C3,
C5 and C7 are four cards, four slots on two cards, or something else.

Sources:
https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html#compute-trays,
https://docs.nvidia.com/dgx/dgxvr-user-guide/networking.html#network-interface-names

## 2. BlueField-4 PCIe entries

Section 2.4, PCIe table (top view), lists `COMPUTE_n_n_BF_0_MAC_ADDR1` on
`000d:41:00.0` (`enP13p65s0f0np0`, `mlx5_30`) and on `0005:41:00.0`
(`enP5p65s0f0np0`, `mlx5_12`). It lists `..._MAC_ADDR2` on the matching
`.1` functions, but with the same interface names as `ADDR1`. The
configuration table says one BlueField-4 per tray. This may mean two PCIe
endpoints on one DPU, or it may be a typo in the table. Not resolved.

## 3. Switch tray serial console

- Section 1.6, Console Access: "Each NVLink switch provides an RJ45 interface
  for serial access. The default serial baud rate is 115200 baud."
- Section 2.5, NVLink Switch Network Ports: "RS232 for BMC, RJ45, Not
  connected".

These may be the same port, which works for console access but is not cabled
to a rack network. Both statements are in the data file. The app does not say
which port Section 1.6 means.

## 4. Rack positions (RU numbers)

Fig. 1 (Rack Configuration) gives the order of the units, top to bottom: 2 ToR
switches, 2 power shelves, 10 compute trays, 9 NVLink 6 switch trays, 8
compute trays, 2 power shelves. It gives no RU numbers, gaps or total rack
height. The app stacks the units without gaps in that order.

## 5. Height of the top-of-rack switches

Not stated. Drawn as 1 RU, marked `assumed` in `rackLayout.heightsRU`.

## 6. Tray numbering

The guide does not number compute trays, switch trays or power shelves. The
app numbers each type from the top down (`compute-tray.1` is the highest
compute tray). This is marked `assumed` in `rackLayout.numbering` and shown
in the side panel. If NVIDIA publishes a numbering scheme, change it in the
data file.

## 7. Counts the guide does not give

These have `count: null` and show "The guide does not state how many":

- HMC per compute tray
- OSFP ports per ConnectX-9 card
- NVLink cable cartridges per rack
- Liquid cooling manifolds per rack

## 8. Fabric of externalnet, internalnet and failovernet

Section 2.2 describes these networks but does not name their fabric. Chapter 2
says Ethernet carries storage, management and external connectivity, but does
not tie that to these networks by name. Their `fabric` is `null`.

## 9. Other things left out on purpose

- How the two Vera CPUs and four Rubin GPUs split across the two compute
  boards. The PCIe labels say `HPM_L GPU_0/1` and `HPM_R GPU_2/3`, but the
  text does not explain `HPM_L` and `HPM_R`. M2 needs this; check Fig. 4
  (block diagram) and Fig. 5 (top view) first.
- What "CPU ERoT" stands for. The guide does not expand it.
- Port counts per ToR switch, ToR model, and which network the ToR uplinks to.

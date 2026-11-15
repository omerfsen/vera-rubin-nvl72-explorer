# Open questions

Places where NVIDIA's documentation is unclear, contradicts itself, or says
nothing. Sources:

- **Guide**: NVIDIA DGX VR NVL72 User Guide, 5 Nov 2026
  (https://docs.nvidia.com/dgx/dgxvr-user-guide/, same content as the PDF).
- **Manual**: NVIDIA DGX VR NVL72 Service Manual, 7 Oct 2026
  (https://docs.nvidia.com/dgx/dgxvr-service-manual/).

"Fig. n" means the guide's figure in the named section. Where the text and a
figure disagree, the data keeps the text, adds a note on the item, and the
conflict is listed here. Anything this project had to assume is marked
`"assumed": true` with a note.

## 1. Number of ConnectX-9 cards per compute tray

- Guide 1.2, configuration table: "2 NVIDIA ConnectX-9 I/O cards for
  InfiniBand cluster interconnect and multi-rack clustering".
- Guide 1.2, Fig. 4 (block diagram): eight ConnectX-9 cards in four pairs,
  attached to CPU0 and CPU1.
- Guide 1.2, Fig. 6 (front view): "2x CX9 Modules" in each of the two Bay B
  sections.
- Guide 2.2, Fig. 1: eight OSFP cages, all marked 5 (computenet).
- Guide 2.4, front-view table: eight rows `C1/C1_1`, `C1/C1_2`, `C3/C3_1`,
  `C3/C3_2`, `C5/C5_1`, `C5/C5_2`, `C7/C7_1`, `C7/C7_2`, one per cage, each
  with its own PCIe bus, interface and RDMA device. The 2.2 and 2.4 figures
  print the last two as `C7/C3_1` and `C7/C3_2`.

The data keeps `count: 2` from the configuration table, with a note on the
component that the panel shows. It records 8 OSFP ports per tray from
Fig. 1. It does not decide whether a "card" is a module, a pair of modules,
or something else.

## 2. BlueField-4 PCIe entries

- Guide 2.4, top-view table: `COMPUTE_n_n_BF_0_MAC_ADDR1` on `000d:41:00.0`
  (`enP13p65s0f0np0`, `mlx5_30`) and on `0005:41:00.0` (`enP5p65s0f0np0`,
  `mlx5_12`), and `..._MAC_ADDR2` on the matching `.1` functions with the same
  interface and RDMA names.
- Guide 2.2 Fig. 2 and 2.4 Fig. 4 print `BF_0` and `BF_1`, and put ADDR1 on the
  left QSFP port and ADDR2 on the right.
- Guide 1.2, Fig. 4: one BlueField-4 with a PCIe link to each CPU.

So the table's second `BF_0` is most likely `BF_1`: one DPU with an endpoint
on each CPU. The repeated interface and RDMA names on the `.1` functions are
still unexplained. The data lists `BF_0` and `BF_1` from the figures and notes
the table.

## 3. BlueField-4 left QSFP port: dgxnet or storagenet?

- Guide 2.3 table: "BlueField-4 left port, QSFP, dgxnet (Ethernet)" and
  "BlueField-4 right port, QSFP, storagenet (Ethernet)".
- Guide 2.2, Fig. 1: "Each number corresponds to a network in the preceding
  list." Both QSFP ports are marked 6 (storagenet). No port is marked 3
  (dgxnet).

The data follows the table (left = dgxnet), with a note on the port and its
connection. The M4 network overlay should show both readings until NVIDIA
clarifies.

## 4. RJ45 ports on the compute tray: three in the table, two in the figures

Guide 2.3 lists three RJ45 ports: BlueField-4 RJ-45 (ipminet), 1 GbE LAN (not
connected) and 1 GbE BMC (ipminet). The front-view figures (2.2 Fig. 1 and
Fig. 2, 1.2 Fig. 6) show only two, both marked 4 (ipminet). Fig. 6 puts the
left one under "BlueField 4" and the right one under "SMM". The position of
the 1 GbE LAN port is unknown.

## 5. NVSwitch chips per switch tray

Guide 1.3 says 4 NVSwitch ASICs per switch tray, and Fig. 7 shows four
"NVLink Switches" cold plates. The block diagram (1.2 Fig. 4) draws two
"NVLink Switch" icons per switch tray. The data keeps 4.

## 6. Switch tray serial console

- Guide 1.6: "Each NVLink switch provides an RJ45 interface for serial
  access. The default serial baud rate is 115200 baud."
- Guide 2.5: "RS232 for BMC, RJ45, Not connected".

These may be the same port, usable for console access but not cabled to a
rack network. Both statements are in the data.

## 7. Rack positions (RU numbers)

Fig. 1 (1.1) gives the order of the units, top to bottom: 2 ToR switches, 2
power shelves, 10 compute trays, 9 NVLink 6 switch trays, 8 compute trays, 2
power shelves. The manual's power shelf figure shows the same order. Neither
gives RU numbers or the total rack height. Fig. 1 also shows blank panels
below the lower power shelves and seismic bracing under the rack. The app
stacks the units without gaps.

## 8. Height of the top-of-rack switches

Not stated. Drawn as 1 RU, marked `assumed`.

## 9. Tray numbering

- **Power shelves:** the manual's power shelf figure (2.2 Identify the Failed
  Power Supply) numbers them 1 to 4 from the bottom up, and the PSUs 1 to 6
  within each shelf (left to right, top to bottom). The app uses this.
- **Switch trays:** the block diagram (1.2 Fig. 4) numbers them 1 to 9 but
  does not say where each sits in the rack.
- **Compute trays:** not numbered anywhere.

For compute and switch trays the app numbers from the top down, marked
`assumed`.

## 10. Counts the documents do not give

These have `count: null` and show "The guide does not state how many":

- HMC per compute tray (Fig. 5 shows one SMM carrier board "w/ BMC+HMC+TPM")
- OSFP ports per ConnectX-9 card (8 per tray, see item 1)
- NVLink cable cartridges per rack
- Liquid cooling manifolds per rack (Fig. 2 points the label at two)

The host BMC, switch BMC, CPU ERoT, power shelf management module and the two
batteries have `count: 1`, read from singular wording or a figure. Each has a
note saying so.

## 11. Fabric of externalnet, internalnet and failovernet

Guide 2.2 describes these networks but does not name their fabric. Chapter 2
says Ethernet carries storage, management and external connectivity, but does
not tie that to these networks by name. Their `fabric` is `null`.

## 12. "Inner manifold"

Guide 1.2: liquid "runs up and down the rack through the inner manifold, then
through the cold plates". Fig. 5 labels an "Internal Manifold" inside the
compute tray, while Fig. 2 shows the rack's liquid cooling manifolds at the
rear. Which one the sentence means is not clear.

## 13. Known parts not yet in the data (for M2 and M3)

Labelled in the guide's figures:

- Compute tray (Fig. 5): the SMM itself (E1.S boot drive + carrier board with
  BMC, HMC, TPM and front IO panel) as one part; the TPM; the bus bar
  connector and water connections are listed as specs only. SOCAMM, the
  Power Distribution Board and the Internal Manifold are in the data since M2.
- Switch tray (Fig. 7): the BMC and CPU ERoT have no position in any figure,
  so they are not drawn. SWB w/ PDB and the SSD are in the data since M3.
- Rear (Fig. 2): rear bezel, FD83 connectors for liquid cooling hoses,
  manifold, cable cartridge and bus bar supports.

Not explained anywhere: what "HPM" and "ERoT" stand for. HPM_L and HPM_R are
"HPM Left" and "HPM Right" (2.4 Fig. 4).

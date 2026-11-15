// TypeScript view of data/nvl72-topology.schema.json. The schema is the
// contract; tests/schema.test.ts checks the data file against it.

export interface Source {
  url: string;
  section: string;
  /** File name under the guide's _images/ folder. */
  figure?: string;
}

export interface Provenance {
  source: Source;
  assumed?: boolean;
  note?: string;
}

export interface Spec {
  label: string;
  value: string | number;
  unit?: string;
  /** Overrides the component source for this spec. */
  source?: Source;
  assumed?: boolean;
  note?: string;
}

export type Fabric = 'InfiniBand' | 'Ethernet' | null;

export interface Network extends Provenance {
  id: string;
  number: number;
  name: string;
  description: string;
  fabric: Fabric;
  /** Where the fabric is stated, when that is not the network's own source. */
  fabricSource?: Source;
}

export type ComponentType =
  | 'rack'
  | 'compute-tray'
  | 'switch-tray'
  | 'power-shelf'
  | 'tor-switch'
  | 'cpu'
  | 'gpu'
  | 'nic'
  | 'dpu'
  | 'drive'
  | 'switch-asic'
  | 'psu'
  | 'bmc'
  | 'controller'
  | 'port'
  | 'cable-cartridge'
  | 'manifold'
  | 'bus-bar'
  | 'battery'
  | 'memory'
  | 'board'
  | 'connector'
  | 'structure';

export interface Component extends Provenance {
  id: string;
  type: ComponentType;
  name: string;
  /** Instances per parent instance; null when the guide does not say. */
  count: number | null;
  parent: string | null;
  description: string;
  function: string;
  networks: string[];
  specs: Spec[];
  /** Extra sources for facts in description and function. */
  textSources?: Source[];
  rearSide?: boolean;
}

export interface RackGroup {
  component: string;
  count: number;
}

export interface Height extends Provenance {
  value: number;
}

export interface RackLayout extends Provenance {
  order: 'top-to-bottom';
  groups: RackGroup[];
  heightsRU?: Record<string, Height>;
  numbering?: Provenance & {
    scheme: 'top-to-bottom-per-type';
    /** Types numbered differently, e.g. power shelves from the bottom up. */
    overrides?: Record<string, Provenance & { order: 'top-to-bottom' | 'bottom-to-top' }>;
  };
}

export type ConnectionKind = 'network' | 'not-connected' | 'nvlink' | 'power' | 'cooling';

export interface Connection extends Provenance {
  id: string;
  from: string;
  to?: string;
  network?: string;
  kind: ConnectionKind;
  description: string;
  /** A conflicting reading kept for the record, shown as a conflict rather than fact. */
  alternative?: boolean;
}

/**
 * A part's place in a schematic tray layout. Top parts: x/z from -0.5 to 0.5
 * across width and depth (+z is the front), w and h as fractions of the tray
 * width, d of its depth. Front parts: y from 0 (bottom) to 1 (top) of the
 * tray, h as a fraction of the tray height.
 */
export interface TraySlot {
  component: string;
  index?: number;
  label?: string;
  face: 'top' | 'front';
  /** Status LEDs drawn on the part's front face. */
  indicators?: { color: 'green' | 'amber'; label: string }[];
  x: number;
  z: number;
  y?: number;
  w: number;
  d: number;
  h: number;
}

export type TrayLinkKind = 'pcie' | 'c2c' | 'clink' | 'nvlink' | 'coolant' | 'power';

/** One end of a link: a part instance, or a named point on the tray. */
export type LinkEnd = { component: string; index?: number; point?: undefined } | { point: string; component?: undefined; index?: undefined };

/** An instance-level connection inside a tray: the "veins" layer. */
export interface TrayLink extends Provenance {
  kind: TrayLinkKind;
  from: LinkEnd;
  to: LinkEnd;
}

export interface TrayPoint {
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface TrayLayout extends Provenance {
  /** Height of the tray in rack units; 1 if omitted. */
  heightRU?: number;
  sources?: Source[];
  notPlaced?: { component: string; reason: string }[];
  slots: TraySlot[];
  points?: TrayPoint[];
  links?: TrayLink[];
}

/** A rear part drawn behind the units, spanning from one unit (or the top) to another (or the bottom). */
export interface RearPart {
  component: string;
  index?: number;
  x: number;
  w: number;
  /** A span from one unit (or "top") to another (or "bottom")... */
  from?: string;
  to?: string;
  /** ...or a short piece at the top, the bottom, or below the stack. */
  at?: 'top' | 'bottom' | 'below';
  heightRU?: number;
  /** Which layer toggle shows it (default parts). */
  layer?: 'parts' | 'structure';
}

/** A connector on the back face of every unit of one type, and the rear part it plugs into. */
export interface UnitConnector {
  unit: string;
  component: string;
  index?: number;
  x: number;
  w: number;
  kind: 'nvlink' | 'cooling' | 'power' | 'ac';
  /** Index into RearLayout.parts; omitted for AC whips, which leave the rack. */
  toPart?: number;
}

export interface RearLayout extends Provenance {
  parts: RearPart[];
  unitConnectors?: UnitConnector[];
}

export interface Topology {
  $schema?: string;
  schemaVersion: 1;
  meta: {
    title: string;
    document: { title: string; date: string; urls: string[] };
    serviceManual?: { title: string; date: string; urls: string[] };
    retrieved: string;
  };
  networks: Network[];
  components: Component[];
  rackLayout: RackLayout;
  trayLayouts?: Record<string, TrayLayout>;
  rearLayout?: RearLayout;
  connections: Connection[];
}
